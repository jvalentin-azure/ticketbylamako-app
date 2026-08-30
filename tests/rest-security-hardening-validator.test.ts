import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const validator = path.join(
  root,
  "scripts",
  "validate-rest-security-hardening.php",
);
const candidate = path.join(root, "scripts", "tbl-rest-security-hardening.php");

const compactGuard = `<?php
ini_set('session.use_only_cookies','1');
ini_set('session.use_strict_mode','1');
add_action('tickera_before_session_start','tbl_rest_harden_php_session_cookie',PHP_INT_MIN);
`;

const spacedGuard = `<?php
ini_set( 'session.use_only_cookies', '1' );
ini_set( 'session.use_strict_mode', '1' );
add_action( 'tickera_before_session_start', 'tbl_rest_harden_php_session_cookie', PHP_INT_MIN );
`;

function validateSource(source: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "tbl-guard-validator-"));
  const sourcePath = path.join(directory, "guard.php");
  writeFileSync(sourcePath, source, "utf8");

  try {
    return spawnSync("php", [validator, sourcePath], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("REST security hardening release validator", () => {
  it.each([
    ["compact calls", compactGuard],
    ["WordPress-spaced calls", spacedGuard],
  ])("accepts %s without depending on formatting", (_label, source) => {
    const result = validateSource(source);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "PASS strict_mode=1 cookies_only=1 tickera_hook=1 session_start=0",
    );
  });

  it("accepts the immutable ebed8d97 candidate", () => {
    const result = spawnSync("php", [validator, candidate], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "sha256=ebed8d97dd9336dc6332844fc43ef417db1eb929f344d1f15c950f559a32d06e",
    );
  });

  it.each([
    [
      "comment-only markers",
      `<?php
// ini_set('session.use_only_cookies', '1');
// ini_set('session.use_strict_mode', '1');
// add_action('tickera_before_session_start', 'tbl_rest_harden_php_session_cookie', PHP_INT_MIN);
`,
    ],
    [
      "strict mode disabled",
      compactGuard.replace("'1');\nadd_action", "'0');\nadd_action"),
    ],
    [
      "missing cookies-only policy",
      compactGuard.replace("ini_set('session.use_only_cookies','1');\n", ""),
    ],
    ["late Tickera hook", compactGuard.replace("PHP_INT_MIN", "10")],
    ["guard starts a session", `${compactGuard}session_start();\n`],
    ["invalid PHP", "<?php ini_set('session.use_strict_mode', '1'"],
  ])("fails closed for %s", (_label, source) => {
    const result = validateSource(source);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^FAIL /);
  });
});

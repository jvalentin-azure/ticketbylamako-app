import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const guardPath = path.join(root, "scripts", "tbl-rest-security-hardening.php");
const harnessPath = path.join(
  root,
  "tests",
  "php",
  "rest-session-cookie-guard-harness.php",
);

describe("global PHP session cookie hardening", () => {
  it.each(["forwarded-https", "production", "http-development", "native-ssl"])(
    "enforces the expected policy for %s without starting a session",
    (scenario) => {
      const result = spawnSync("php", [harnessPath, scenario], {
        cwd: root,
        encoding: "utf8",
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`${scenario} PASS session_start=0`);
      expect(result.stdout).toContain("provider_calls=0 writes=0");
    },
  );

  it("hardens before plugin sessions and never owns session startup", () => {
    const source = fs.readFileSync(guardPath, "utf8");
    expect(source).toContain("tbl_rest_harden_php_session_cookie();");
    expect(source).toContain("tickera_before_session_start");
    expect(source).toContain("'httponly' => true");
    expect(source).toContain("'samesite' => 'Lax'");
    expect(source).toContain("'path'     => '/'");
    expect(source).not.toMatch(/\bsession_start\s*\(/);
  });
});

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const validator = path.join(
  root,
  "scripts",
  "validate-tickera-stateless-rest-runtime.php",
);
const runner = path.join(
  root,
  "scripts",
  "qa-tickera-stateless-rest-runtime.php",
);
const libraryHarness = path.join(
  root,
  "tests",
  "php",
  "tickera-stateless-rest-runtime-library-harness.php",
);

function fileSha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function validReport() {
  return {
    schemaVersion: 2,
    phase: "S",
    runtime: {
      executed: true,
      synthetic: false,
      freshProcess: true,
      executionKind: "CLI_FRONT_CONTROLLER",
      wordpressLoaded: true,
      hostIsStaging: true,
      tickeraLoaded: true,
      tickeraVersion: "3.6.0.2",
      tickeraSourceSha256:
        "beb244415bf3e874925bd76a88f9bbf19c246121251877723dc6a3db41caac52",
      shimLoaded: true,
      shimSha256:
        "9ee50c7fc73bbe4f2cebcd17ca8aac93aface21f7620e85d83cf2babe3ec1ddf",
      requestAllowlisted: true,
      fatalError: false,
      runnerSha256: fileSha256(runner),
      validatorSha256: fileSha256(validator),
      invocationNonceSha256: "0".repeat(64),
      wpConfigSha256: "1".repeat(64),
      isolationProofSha256: "2".repeat(64),
    },
    instrumentation: {
      preinitializedBeforeBootstrap: true,
      queryFilterLiveAtWpLoaded: true,
      wpHttpFilterLiveAtWpLoaded: true,
      restPostDispatchObserved: true,
    },
    isolation: {
      databaseReadOnlyEnforced: true,
      objectCacheWritesBlocked: true,
      directNetworkEgressBlocked: true,
      productionCredentialsUnavailable: true,
      activePluginFingerprintSha256: "3".repeat(64),
      evidenceManifestSha256: "4".repeat(64),
    },
    request: {
      method: "GET",
      route: "/lamako-mobile/v2/public/home-data",
    },
    hook: {
      before: 10 as number | false,
      after: false as number | false,
      guardPriorityIsMin: true,
      sequence: [
        "wp_loaded_before",
        "wp_loaded_reinforce",
        "wp_loaded_after",
        "rest_before_callbacks",
        "rest_post_dispatch",
        "shutdown",
      ],
    },
    session: {
      handlerInstalledBeforeBootstrap: true,
      handlerReinforcedAtWpLoaded: true,
      handlerReinforcedBeforeRestCallback: true,
      statusBefore: 1,
      statusAtWpLoadedBefore: 1,
      statusAtWpLoadedReinforce: 1,
      statusAtWpLoadedAfter: 1,
      statusBeforeRestCallback: 1,
      statusAtShutdownBeforeCleanup: 1,
      statusAtShutdownAfterCleanup: 1,
      open: 0,
      read: 0,
      write: 0,
      destroy: 0,
      close: 0,
      gc: 0,
      createSid: 0,
      validateId: 0,
      updateTimestamp: 0,
    },
    network: {
      blockInstalled: true,
      coverage: "WP_HTTP_API_ONLY",
      directTransportBlocked: false,
      externalEgressProofRequired: true,
      wpHttpAttempts: 0,
      blockedWpHttpAttempts: 0,
    },
    database: {
      guardScope: "WPDB_QUERY_FILTER_ONLY",
      directDriverBlocked: false,
      externalReadOnlyProofRequired: true,
      totalQueries: 3,
      readOnlyQueries: 3,
      nonReadAttempts: 0,
      blockedNonReadAttempts: 0,
    },
    cache: {
      declaredPreflightState: "HIT",
      observedPreflightState: "HIT",
      responseState: "HIT",
      setTransientAttempts: 0,
      writeBlockInstalled: true,
    },
    mutations: { businessHooks: 0 },
    response: {
      httpStatus: 200,
      jsonValid: true,
      authSemanticsValid: true,
      headersObservable: false,
      externalHttpRequired: true,
    },
  };
}

type RuntimeReport = ReturnType<typeof validReport>;

function validate(report: RuntimeReport) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "tbl-runtime-gate-"));
  const reportPath = path.join(directory, "runtime-report.json");
  writeFileSync(reportPath, JSON.stringify(report), "utf8");
  try {
    return spawnSync("php", [validator, reportPath], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runLibraryScenario(scenario: string) {
  const result = spawnSync("php", [libraryHarness, scenario], {
    cwd: root,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
}

describe("Tickera runtime qualification gate", () => {
  it("accepts a complete CLI component report while requiring external HTTP evidence", () => {
    const result = validate(validReport());

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("COMPONENT_PASS_EXTERNAL_REQUIRED");
  });

  it.each([
    [
      "missing runtime",
      (report: RuntimeReport) => (report.runtime.executed = false),
      "runtime_not_executed",
    ],
    [
      "synthetic evidence",
      (report: RuntimeReport) => (report.runtime.synthetic = true),
      "synthetic_runtime",
    ],
    [
      "wrong Tickera hash",
      (report: RuntimeReport) =>
        (report.runtime.tickeraSourceSha256 = "0".repeat(64)),
      "tickera_hash",
    ],
    [
      "hook not removed",
      (report: RuntimeReport) => (report.hook.after = 10),
      "tickera_hook_after",
    ],
    [
      "session opened",
      (report: RuntimeReport) => (report.session.open = 1),
      "session_open",
    ],
    [
      "session written",
      (report: RuntimeReport) => (report.session.write = 1),
      "session_write",
    ],
    [
      "provider attempted",
      (report: RuntimeReport) => (report.network.wpHttpAttempts = 1),
      "provider_http_attempt",
    ],
    [
      "SQL write attempted",
      (report: RuntimeReport) => (report.database.nonReadAttempts = 1),
      "sql_non_read",
    ],
    [
      "cold cache",
      (report: RuntimeReport) => (report.cache.observedPreflightState = "MISS"),
      "cache_not_hot_before",
    ],
    [
      "transient attempted",
      (report: RuntimeReport) => (report.cache.setTransientAttempts = 1),
      "cache_write",
    ],
    [
      "business hook fired",
      (report: RuntimeReport) => (report.mutations.businessHooks = 1),
      "business_mutation_hook",
    ],
    [
      "missing external HTTP gate",
      (report: RuntimeReport) => (report.response.externalHttpRequired = false),
      "external_http_gate_missing",
    ],
    [
      "invalid JSON",
      (report: RuntimeReport) => (report.response.jsonValid = false),
      "invalid_json",
    ],
  ])("fails closed for %s", (_label, mutate, failure) => {
    const report = validReport();
    mutate(report);
    const result = validate(report);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(failure);
  });

  it("refuses to run without a real WordPress root", () => {
    const result = spawnSync("php", [runner], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("STOP real_wordpress_runtime_required\n");
  });

  it.each([
    ["sql-select", "SELECT", true],
    ["sql-comment-show", "SHOW", true],
    ["sql-update", "UPDATE", false],
    ["sql-cte", "WITH", false],
    ["sql-multiple", "SELECT", false],
    ["sql-versioned-comment", "SELECT", false],
    ["sql-select-for-update", "SELECT", false],
    ["sql-select-get-lock", "SELECT", false],
  ])("classifies %s conservatively", (scenario, operation, readOnly) => {
    expect(runLibraryScenario(scenario)).toEqual({ operation, readOnly });
  });

  it("accepts only the private runner's exact public read URI form", () => {
    expect(runLibraryScenario("uri-allowed")).toEqual({
      route: "/lamako-mobile/v2/public/home-data",
      get: { summary: "1", events_limit: "12", products_limit: "8" },
    });
    for (const scenario of [
      "uri-mutative-query",
      "uri-encoded-path",
      "uri-unknown-route",
    ]) {
      expect(runLibraryScenario(scenario)).toBeNull();
    }
  });

  it("requires independently asserted DB, cache, egress, and credential isolation", () => {
    expect(runLibraryScenario("isolation-valid")).toEqual([]);
    expect(runLibraryScenario("isolation-cache-unblocked")).toContain(
      "objectCacheWritesBlocked",
    );
  });
});

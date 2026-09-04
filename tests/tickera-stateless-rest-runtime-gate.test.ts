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
const shutdownHarness = path.join(
  root,
  "tests",
  "php",
  "tickera-stateless-rest-runtime-shutdown-harness.php",
);
const isolationHarness = path.join(
  root,
  "tests",
  "php",
  "tickera-phase-s-isolation-harness.php",
);
const invocationHash = "a".repeat(64);

function fileSha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function validReport(
  method: "GET" | "HEAD" | "OPTIONS" = "GET",
  route = "/lamako-mobile/v2/public/home-data",
  urlForm: "PRETTY" | "REST_ROUTE" = "PRETTY",
) {
  const catalogRoute = route.startsWith("/lamako-mobile/v2/public/");
  const webSession = route === "/lamako-mobile/v2/web-session";
  const callbackRuns = method !== "OPTIONS";
  const sequence = [
    "wp_loaded_before",
    "wp_loaded_reinforce",
    "wp_loaded_after",
    "rest_pre_dispatch",
  ];
  if (callbackRuns) sequence.push("rest_before_callbacks");
  sequence.push("rest_post_dispatch", "wp_shutdown", "reporter_destruct");

  return {
    schemaVersion: 4,
    phase: "S",
    runtime: {
      executed: true,
      syntheticRequest: true,
      realWordPressRuntime: true,
      freshProcess: true,
      executionKind: "CLI_SYNTHETIC_REQUEST_REAL_BOOTSTRAP",
      wordpressLoaded: true,
      hostIsIsolatedClone: true,
      wpEnvironmentType: "staging",
      wpRoot: "/srv/tbl-phase-s-clone/current",
      cloneHost: "phase-s-clone.invalid",
      tickeraLoaded: true,
      tickeraVersion: "3.6.0.2",
      tickeraSourceSha256:
        "beb244415bf3e874925bd76a88f9bbf19c246121251877723dc6a3db41caac52",
      shimLoaded: true,
      shimSha256:
        "700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222",
      requestAllowlisted: true,
      isolationGuardLoaded: true,
      isolationGuardSha256: "3".repeat(64),
      isolationGuardState: {
        jetpackListenerDisabled: true,
        jetpackSenderDisabled: true,
        checkinInstallerRemoved: true,
        asyncRunnerDisabled: true,
        mailDeliveryDisabled: true,
      },
      fatalError: false,
      runnerSha256: fileSha256(runner),
      validatorSha256: fileSha256(validator),
      invocationIdSha256: invocationHash,
      requestFingerprintSha256: "b".repeat(64),
      wpConfigSha256: "c".repeat(64),
      isolationProofSha256: "d".repeat(64),
      httpEvidenceIncluded: false,
    },
    instrumentation: {
      preinitializedBeforeBootstrap: true,
      prebootstrapQualification: {
        proofValidated: true,
        environmentQualified: true,
        rootQualified: true,
        databaseQualified: true,
        cacheQualified: true,
        networkQualified: true,
        filesystemQualified: true,
      },
      filterHealthAtWpLoaded: {
        queryEarly: true,
        queryFinal: true,
        httpEarly: true,
        httpFinal: true,
      },
      filterHealthAtWpShutdown: {
        queryEarly: true,
        queryFinal: true,
        httpEarly: true,
        httpFinal: true,
      },
      filterHealthAtReporter: {
        queryEarly: true,
        queryFinal: true,
        httpEarly: true,
        httpFinal: true,
      },
      restPreDispatchObserved: true,
      restCallbackObserved: callbackRuns,
      restPostDispatchObserved: true,
      wp_shutdown_seen: true,
      reporterAfterWpShutdown: true,
    },
    isolation: {
      assertionSource: "EXTERNAL_SEALED_PROVISIONING",
      runnerVerificationScope: "MANIFEST_SHAPE_HASH_AND_BINDING_ONLY",
      environment: "isolated-clone",
      cloneOnly: true,
      databaseReadOnlyEnforced: true,
      databaseCanaryWriteRejected: true,
      databaseControl: "CLONE_SELECT_ONLY_CREDENTIAL",
      databaseTargetFingerprintSha256: "e".repeat(64),
      objectCacheWritesBlocked: true,
      objectCacheControl: "CLONE_EPHEMERAL_OR_WRITE_DENIED",
      objectCacheTargetFingerprintSha256: "f".repeat(64),
      directNetworkEgressBlocked: true,
      networkControl: "PROCESS_EGRESS_DENY",
      filesystemWritesDeniedOrEphemeral: true,
      filesystemControl: "READ_ONLY_ROOT_EPHEMERAL_TMP",
      productionCredentialsUnavailable: true,
      cronDisabled: true,
      queueWorkersDisabled: true,
      mailDeliveryDisabled: true,
      providerCallbacksDisabled: true,
      sideEffectControlsSha256: "3".repeat(64),
      publicAccessRestricted: true,
      activePluginFingerprintSha256: "1".repeat(64),
      evidenceManifestSha256: "2".repeat(64),
    },
    request: {
      method,
      route,
      urlForm,
      webSessionMode: webSession ? "ANONYMOUS_CLI" : "NOT_APPLICABLE",
      requestFingerprintSha256: "b".repeat(64),
    },
    hook: {
      before: 10 as number | false,
      after: false as number | false,
      atWpShutdown: false as number | false,
      atReporter: false as number | false,
      guardPriorityIsMin: true,
      beforeInventory: [
        {
          class: "Tickera\\TC",
          method: "update_cart",
          priority: 10,
          isGlobalTc: true,
          sourceSha256:
            "beb244415bf3e874925bd76a88f9bbf19c246121251877723dc6a3db41caac52",
        },
      ],
      afterInventory: [] as Record<string, unknown>[],
      shutdownInventory: [] as Record<string, unknown>[],
      reporterInventory: [] as Record<string, unknown>[],
      sequence,
    },
    session: {
      handlerInstalledBeforeBootstrap: true,
      handlerReinforcedAtWpLoaded: true,
      handlerReinforcedBeforeRestCallback: callbackRuns,
      autoStartBefore: "0",
      autoStartAtWpShutdown: "0",
      headersSentBefore: false,
      strictModeBefore: "1",
      strictModeAtWpLoaded: "1",
      statusBefore: 1,
      moduleBefore: "files",
      moduleAfterInstall: "user",
      statusAtWpLoadedBefore: 1,
      moduleAtWpLoadedBefore: "user",
      statusAtWpLoadedReinforce: 1,
      moduleAtWpLoadedReinforce: "user",
      moduleAfterWpLoadedReinforce: "user",
      statusAtWpLoadedAfter: 1,
      moduleAtWpLoadedAfter: "user",
      statusAtRestPreDispatch: 1,
      moduleAtRestPreDispatch: "user",
      statusBeforeRestCallback: callbackRuns ? 1 : null,
      moduleBeforeRestCallback: callbackRuns ? "user" : null,
      moduleAfterRestReinforce: callbackRuns ? "user" : null,
      statusAtWpShutdown: 1,
      moduleAtWpShutdown: "user",
      statusAtReporterBeforeCleanup: 1,
      moduleAtReporterBeforeCleanup: "user",
      statusAtReporterAfterCleanup: 1,
      moduleAtReporterAfterCleanup: "user",
      cleanupMethod: "NONE",
      cleanupSucceeded: true,
      firstEvent: null as string | null,
      firstEventStack: [] as Record<string, unknown>[],
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
      finalBlockCalls: 0,
    },
    database: {
      guardScope: "WPDB_QUERY_FILTER_ONLY",
      directDriverBlocked: false,
      externalReadOnlyProofRequired: true,
      totalQueries: 3,
      readOnlyQueries: 3,
      connectionLocalQueries: 0,
      finalQueries: 3,
      finalReadOnlyQueries: 3,
      finalConnectionLocalQueries: 0,
      nonReadAttempts: 0,
      blockedNonReadAttempts: 0,
      lateNonReadAttempts: 0,
      blockedOperations: [] as string[],
    },
    cache: {
      declaredPreflightState: catalogRoute ? "HIT" : "NOT_APPLICABLE",
      observedPreflightState: catalogRoute ? "HIT" : "NOT_APPLICABLE",
      responseState: catalogRoute ? "HIT" : "NOT_APPLICABLE",
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
    externalHttpContract: {
      required: true,
      freshProcessPerCase: true,
      methods: ["GET", "HEAD", "OPTIONS"],
      urlForms: ["PRETTY", "REST_ROUTE"],
      webSessionModes: ["ANONYMOUS", "AUTHENTICATED"],
      corsJwtStatusRequired: true,
      phpSessionCookieForbidden: true,
    },
    report: {
      attempts: 1,
      emitted: true,
      intendedExitCode: 0,
    },
    reportEmitted: true,
    decision: "COMPONENT_PASS_EXTERNAL_REQUIRED",
  };
}

type RuntimeReport = ReturnType<typeof validReport>;

function validate(report: RuntimeReport, expectedInvocation = invocationHash) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "tbl-runtime-gate-"));
  const reportPath = path.join(directory, "runtime-report.json");
  writeFileSync(reportPath, JSON.stringify(report), "utf8");
  try {
    return spawnSync("php", [validator, reportPath, expectedInvocation], {
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
  it.each([
    ["GET", "PRETTY"],
    ["HEAD", "REST_ROUTE"],
    ["OPTIONS", "REST_ROUTE"],
  ] as const)(
    "accepts a complete %s/%s CLI component report while requiring HTTP evidence",
    (method, urlForm) => {
      const result = validate(validReport(method, undefined, urlForm));

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("COMPONENT_PASS_EXTERNAL_REQUIRED");
    },
  );

  it("accepts anonymous CLI web-session semantics without claiming authenticated HTTP evidence", () => {
    const result = validate(
      validReport("GET", "/lamako-mobile/v2/web-session", "PRETTY"),
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("COMPONENT_PASS_EXTERNAL_REQUIRED");
  });

  it("accepts only fully accounted connection-local SQL alongside read-only queries", () => {
    const report = validReport();
    report.database.totalQueries = 5;
    report.database.readOnlyQueries = 3;
    report.database.connectionLocalQueries = 2;
    report.database.finalQueries = 5;
    report.database.finalReadOnlyQueries = 3;
    report.database.finalConnectionLocalQueries = 2;

    const result = validate(report);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("COMPONENT_PASS_EXTERNAL_REQUIRED");
  });

  it("rejects an unaccounted SQL query even when the non-read counter is zero", () => {
    const report = validReport();
    report.database.totalQueries = 4;

    const result = validate(report);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("query_count_mismatch");
  });

  it.each([
    [
      "missing runtime",
      (report: RuntimeReport) => (report.runtime.executed = false),
      "runtime_not_executed",
    ],
    [
      "claimed real HTTP evidence",
      (report: RuntimeReport) => (report.runtime.httpEvidenceIncluded = true),
      "cli_http_evidence_claim",
    ],
    [
      "wrong Tickera hash",
      (report: RuntimeReport) =>
        (report.runtime.tickeraSourceSha256 = "0".repeat(64)),
      "tickera_hash",
    ],
    [
      "missing prebootstrap database qualification",
      (report: RuntimeReport) =>
        (report.instrumentation.prebootstrapQualification.databaseQualified = false),
      "prebootstrap_qualification",
    ],
    [
      "lost query hook",
      (report: RuntimeReport) =>
        (report.instrumentation.filterHealthAtReporter.queryFinal = false),
      "filterHealthAtReporter",
    ],
    [
      "missing WordPress shutdown marker",
      (report: RuntimeReport) =>
        (report.instrumentation.wp_shutdown_seen = false),
      "wp_shutdown_not_seen",
    ],
    [
      "report emitted before WordPress shutdown",
      (report: RuntimeReport) =>
        (report.instrumentation.reporterAfterWpShutdown = false),
      "reporter_not_after_wp_shutdown",
    ],
    [
      "extra Tickera callback",
      (report: RuntimeReport) =>
        report.hook.beforeInventory.push({
          ...report.hook.beforeInventory[0],
          priority: 11,
        }),
      "tickera_inventory_before",
    ],
    [
      "Tickera callback restored during shutdown",
      (report: RuntimeReport) =>
        report.hook.reporterInventory.push(report.hook.beforeInventory[0]),
      "tickera_reporterInventory",
    ],
    [
      "session opened",
      (report: RuntimeReport) => (report.session.open = 1),
      "session_open",
    ],
    [
      "session event captured",
      (report: RuntimeReport) => (report.session.firstEvent = "write"),
      "session_first_event",
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
      "no query observed",
      (report: RuntimeReport) => {
        report.database.totalQueries = 0;
        report.database.readOnlyQueries = 0;
        report.database.finalQueries = 0;
        report.database.finalReadOnlyQueries = 0;
      },
      "query_total",
    ],
    [
      "late query telemetry mismatch",
      (report: RuntimeReport) => (report.database.finalQueries = 2),
      "final_query_count",
    ],
    [
      "missing DB target binding",
      (report: RuntimeReport) =>
        (report.isolation.databaseTargetFingerprintSha256 = ""),
      "isolation_databaseTargetFingerprintSha256",
    ],
    [
      "missing external egress gate",
      (report: RuntimeReport) =>
        (report.isolation.directNetworkEgressBlocked = false),
      "isolation_directNetworkEgressBlocked",
    ],
    [
      "cold cache",
      (report: RuntimeReport) => (report.cache.observedPreflightState = "MISS"),
      "cache_not_hot_before",
    ],
    [
      "duplicate report",
      (report: RuntimeReport) => (report.report.attempts = 2),
      "report_attempts",
    ],
    [
      "business hook fired",
      (report: RuntimeReport) => (report.mutations.businessHooks = 1),
      "business_mutation_hook",
    ],
  ])("fails closed for %s", (_label, mutate, failure) => {
    const report = validReport();
    mutate(report);
    const result = validate(report);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(failure);
  });

  it("binds validation to the independently supplied invocation hash", () => {
    const result = validate(validReport(), "0".repeat(64));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("invocation_hash");
  });

  it("refuses to run without a real isolated WordPress clone root", () => {
    const result = spawnSync("php", [runner], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("STOP real_wordpress_runtime_required\n");
  });

  it("emits exactly one late STOP report and exits nonzero after shutdown", () => {
    const result = spawnSync("php", [shutdownHarness], {
      cwd: root,
      encoding: "utf8",
    });
    const reportLines = result.stderr
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.startsWith("TBL_TICKERA_RUNTIME_REPORT "));

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(reportLines).toHaveLength(1);
    const report = JSON.parse(
      reportLines[0].slice("TBL_TICKERA_RUNTIME_REPORT ".length),
    );
    expect(report.instrumentation.wp_shutdown_seen).toBe(true);
    expect(report.instrumentation.reporterAfterWpShutdown).toBe(true);
    expect(report.hook.sequence).toEqual(["wp_shutdown", "reporter_destruct"]);
    expect(report.report.attempts).toBe(1);
    expect(report.report.intendedExitCode).toBe(1);
    expect(report.decision).toBe("STOP");
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

  it.each([
    ["sql-mailpoet-timezone", true],
    ["sql-mailpoet-big-selects", true],
    ["sql-set-dangerous", false],
    ["sql-set-global", false],
  ])(
    "classifies %s as a bounded connection-local statement",
    (scenario, connectionLocal) => {
      expect(runLibraryScenario(scenario)).toEqual({
        operation: "SET",
        connectionLocal,
      });
    },
  );

  it("requires the clone-only isolation guard controls", () => {
    const result = spawnSync("php", [isolationHarness, "active"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const evidence = JSON.parse(result.stdout);
    expect(evidence.version).toBe("1.0.0");
    expect(evidence.qualified).toBe(true);
    expect(evidence.active).toBe(true);
    expect(evidence.state).toEqual({
      jetpackListenerDisabled: true,
      jetpackSenderDisabled: true,
      checkinInstallerRemoved: true,
      asyncRunnerDisabled: true,
      mailDeliveryDisabled: true,
    });
    for (const priorities of Object.values(
      evidence.filterPriorities,
    ) as string[][]) {
      expect(priorities).toEqual(["PHP_INT_MIN"]);
    }
    expect(evidence.checkinRemaining).toEqual([]);
  });

  it.each(["missing-constant", "staging-host"])(
    "keeps the clone-only isolation guard inert for %s",
    (scenario) => {
      const result = spawnSync("php", [isolationHarness, scenario], {
        cwd: root,
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const evidence = JSON.parse(result.stdout);
      expect(evidence.qualified).toBe(false);
      expect(evidence.active).toBe(false);
      expect(evidence.filterPriorities).toEqual({});
      expect(evidence.checkinRemaining).toEqual([
        "tbl_checkin_facts_install_schema",
      ]);
    },
  );

  it("accepts exact GET, HEAD, OPTIONS, rest_route, and web-session request forms", () => {
    expect(runLibraryScenario("request-pretty-get")).toMatchObject({
      method: "GET",
      route: "/lamako-mobile/v2/public/home-data",
      urlForm: "PRETTY",
      get: { summary: "1", events_limit: "12", products_limit: "8" },
    });
    expect(runLibraryScenario("request-rest-route-head")).toMatchObject({
      method: "HEAD",
      route: "/lamako-mobile/v2/public/events/42",
      urlForm: "REST_ROUTE",
    });
    expect(runLibraryScenario("request-rest-route-options")).toMatchObject({
      method: "OPTIONS",
      route: "/lamako-mobile/v2/rewards/config",
      urlForm: "REST_ROUTE",
    });
    expect(runLibraryScenario("request-web-session")).toMatchObject({
      method: "GET",
      route: "/lamako-mobile/v2/web-session",
    });
  });

  it("rejects mutative, ambiguous, encoded, and unknown requests", () => {
    for (const scenario of [
      "request-post",
      "request-duplicate-rest-route",
      "request-mutative-query",
      "request-encoded-path",
      "request-unknown-route",
    ]) {
      expect(runLibraryScenario(scenario)).toBeNull();
    }
  });

  it("requires independently bound DB, cache, egress, filesystem, and clone isolation", () => {
    expect(runLibraryScenario("isolation-valid")).toEqual([]);
    expect(runLibraryScenario("isolation-cache-unblocked")).toContain(
      "objectCacheWritesBlocked",
    );
    expect(runLibraryScenario("isolation-database-unbound")).toContain(
      "databaseTargetFingerprintSha256",
    );
    expect(runLibraryScenario("isolation-cache-unbound")).toContain(
      "objectCacheTargetFingerprintSha256",
    );
    expect(runLibraryScenario("isolation-source-staging-root")).toContain(
      "source_staging_root_forbidden",
    );
    expect(runLibraryScenario("isolation-side-effect-unbound")).toContain(
      "side_effect_controls_hash",
    );
  });

  it("implements the complete PHP session handler extension contracts", () => {
    expect(runLibraryScenario("handler-contract")).toEqual({
      sessionHandler: true,
      sessionId: true,
      sessionUpdateTimestamp: true,
      hasCreateSid: true,
      hasValidateId: true,
      hasUpdateTimestamp: true,
    });
  });

  it("captures a location-only stack without handler arguments or PII", () => {
    const evidence = runLibraryScenario("handler-safe-stack");
    const serialized = JSON.stringify(evidence);

    expect(evidence.firstEvent).toBe("write");
    expect(evidence.firstEventStack.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("PII-session-id-never-report");
    expect(serialized).not.toContain("PII-session-data-never-report");
    expect(serialized).not.toMatch(/"args"/);
    expect(serialized).toContain("<PROBE_ROOT>");
  });

  it("never closes or writes a session as part of reporter cleanup", () => {
    const source = readFileSync(runner, "utf8");

    expect(source).not.toContain("session_write_close");
    expect(source).toContain("session_abort");
    expect(source).toContain("DEBUG_BACKTRACE_IGNORE_ARGS");
  });
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type TraceFrame = {
  file: string;
  line: number;
  function: string;
  class: string;
  type: string;
};

type HarnessResult = {
  scenario: string;
  active: boolean;
  requestAuthorized: boolean;
  outputPathValidBeforeTrace: boolean;
  handlerBefore: string;
  handlerAfter: string;
  traceExists: boolean;
  traceIsJson: boolean;
  traceEvent: string | null;
  refusalReason: string | null;
  reportedRequestShape: Record<string, boolean | string> | null;
  gateReport: Record<string, unknown> | null;
  traceMethod: string | null;
  traceFrames: TraceFrame[] | null;
  traceKeys: string[] | null;
  traceContainsToken: boolean;
  traceContainsQuery: boolean;
  traceContainsCookie: boolean;
  traceContainsUserAgent: boolean;
  traceContainsContentLength: boolean;
  traceContainsContentType: boolean;
  traceContainsFixtureRoot: boolean;
  anonymousSymbolRedacted: boolean;
  sessionPreserved: boolean | null;
  oneTraceOnly: boolean;
  existingOutputPreserved: boolean;
};

const harness = resolve("tests/php/session-first-caller-probe-harness.php");
const probe = resolve("scripts/tbl-session-first-caller-probe.php");

function runScenario(scenario: string): HarnessResult {
  return JSON.parse(
    execFileSync("php", [harness, scenario], { encoding: "utf8" }),
  ) as HarnessResult;
}

describe("temporary first session caller probe", () => {
  it.each([
    ["authorized-get", "GET"],
    ["authorized-head", "HEAD"],
    ["fpm-empty-content-metadata", "GET"],
  ])("captures one redacted trace and preserves sessions for %s", (scenario, method) => {
    const result = runScenario(scenario);

    expect(result.requestAuthorized).toBe(true);
    expect(result.outputPathValidBeforeTrace).toBe(true);
    expect(result.active).toBe(true);
    expect(result.handlerBefore).toBe("files");
    expect(result.handlerAfter).toBe("user");
    expect(result.traceExists).toBe(true);
    expect(result.traceIsJson).toBe(true);
    expect(result.traceEvent).toBe("first_session_handler_open");
    expect(result.traceMethod).toBe(method);
    expect(result.traceKeys).toEqual([
      "schema",
      "event",
      "capturedAtUtc",
      "requestMethod",
      "originalHandler",
      "frames",
    ]);
    expect(result.traceFrames?.some((frame) => frame.function === "session_start")).toBe(true);
    expect(result.traceFrames?.every((frame) => frame.file.startsWith("["))).toBe(true);
    expect(result.traceContainsToken).toBe(false);
    expect(result.traceContainsQuery).toBe(false);
    expect(result.traceContainsCookie).toBe(false);
    expect(result.traceContainsUserAgent).toBe(false);
    expect(result.traceContainsFixtureRoot).toBe(false);
    expect(result.anonymousSymbolRedacted).toBe(true);
    expect(result.sessionPreserved).toBe(true);
    expect(result.oneTraceOnly).toBe(true);
  });

  it.each([
    ["nonempty-content-length", "contentLengthEmpty"],
    ["nonempty-content-type", "contentTypeEmpty"],
    ["query", "queryStringEmpty"],
    ["cookie", "cookiesEmpty"],
  ])("writes only a bounded refusal report for %s", (scenario, rejectedField) => {
    const result = runScenario(scenario);

    expect(result.requestAuthorized).toBe(false);
    expect(result.active).toBe(false);
    expect(result.handlerAfter).toBe(result.handlerBefore);
    expect(result.traceIsJson).toBe(true);
    expect(result.traceEvent).toBe("probe_gate_refused");
    expect(result.refusalReason).toBe("request_shape");
    expect(result.reportedRequestShape?.[rejectedField]).toBe(false);
    expect(Object.keys(result.gateReport ?? {})).toEqual([
      "schema",
      "event",
      "reason",
      "requestShape",
      "sessionStatus",
      "sessionModule",
      "sessionHandlerClassAvailable",
      "handlerRegistrationAvailable",
      "configValid",
      "outputValid",
    ]);
    expect(result.gateReport).toMatchObject({
      schema: 2,
      event: "probe_gate_refused",
      reason: "request_shape",
      sessionStatus: "none",
      sessionModule: "files",
      sessionHandlerClassAvailable: true,
      handlerRegistrationAvailable: true,
      configValid: true,
      outputValid: true,
    });
    expect(result.traceContainsToken).toBe(false);
    expect(result.traceContainsQuery).toBe(false);
    expect(result.traceContainsCookie).toBe(false);
    expect(result.traceContainsUserAgent).toBe(false);
    expect(result.traceContainsContentLength).toBe(false);
    expect(result.traceContainsContentType).toBe(false);
    expect(result.traceContainsFixtureRoot).toBe(false);
  });

  it.each([
    "ordinary",
    "wrong-token",
    "short-token",
    "invalid-config",
    "public-output",
    "active-session",
    "user-handler",
  ])("refuses activation without the complete exact gate for %s", (scenario) => {
    const result = runScenario(scenario);

    expect(result.active).toBe(false);
    expect(result.handlerAfter).toBe(result.handlerBefore);
    expect(result.traceExists).toBe(false);
    expect(result.traceIsJson).toBe(false);
    expect(result.sessionPreserved).toBe(null);
  });

  it("never overwrites an existing operator output", () => {
    const result = runScenario("existing-output");

    expect(result.requestAuthorized).toBe(true);
    expect(result.outputPathValidBeforeTrace).toBe(false);
    expect(result.active).toBe(false);
    expect(result.existingOutputPreserved).toBe(true);
  });

  it("keeps the source one-shot, transparent, and free of request payload logging", () => {
    const source = readFileSync(probe, "utf8");

    expect(source).toContain("HTTP_X_TBL_SESSION_PROBE_TOKEN");
    expect(source).toContain("tbl-session-first-caller-probe-config.json");
    expect(source).toContain("tokenSha256");
    expect(source).toContain("outputPath");
    expect(source).not.toContain("getenv(");
    expect(source).toContain("DEBUG_BACKTRACE_IGNORE_ARGS");
    expect(source).toContain("probe_gate_refused");
    expect(source).toContain("return parent::open( $path, $name )");
    expect(source).toContain("@fopen( $output_path, 'x' )");
    expect(source).toContain("$this->captured = true");
    expect(source).not.toMatch(/\bsession_start\s*\(/);
    expect(source).not.toMatch(/\bsession_destroy\s*\(/);
    expect(source).not.toMatch(/\bsetcookie\s*\(/);
    expect(source).not.toMatch(/\bheader\s*\(/);
    expect(source).not.toMatch(/\berror_log\s*\(/);
    expect(source).not.toContain("$frame['args']");
    expect(source).not.toContain("QUERY_STRING' =>");
    expect(source).not.toContain("$_COOKIE' =>");
  });
});

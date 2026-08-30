import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type HarnessResult = {
  scenario: string;
  allowlisted: boolean;
  guardRunsFirst: boolean;
  wpLoadedPriorityBefore: number | false;
  wpLoadedPriorityAfter: number | false;
  sessionStartCalls: number;
  unrelatedWpLoadedCalls: number;
  adminPostPriority: number;
  adminPostNoPrivPriority: number;
  corsPriority: number;
  jwtPriority: number;
  providerCalls: number;
  writes: number;
};

const harness = resolve("tests/php/tickera-stateless-rest-harness.php");
const shim = resolve("scripts/tbl-tickera-stateless-rest.php");

function runScenario(scenario: string): HarnessResult {
  return JSON.parse(
    execFileSync("php", [harness, scenario], { encoding: "utf8" }),
  ) as HarnessResult;
}

function expectNeighborHooksUntouched(result: HarnessResult) {
  expect(result.guardRunsFirst).toBe(true);
  expect(result.adminPostPriority).toBe(10);
  expect(result.adminPostNoPrivPriority).toBe(10);
  expect(result.corsPriority).toBe(10);
  expect(result.jwtPriority).toBe(99);
  expect(result.unrelatedWpLoadedCalls).toBe(1);
  expect(result.providerCalls).toBe(0);
  expect(result.writes).toBe(0);
}

describe("Tickera stateless REST MU shim", () => {
  it.each([
    "pretty-get-home",
    "pretty-head-event",
    "pretty-options-product",
    "pretty-get-events",
    "pretty-get-shop",
    "pretty-head-rewards",
    "pretty-options-session",
    "query-get-rewards",
    "query-head-session",
    "query-get-home",
    "query-options-events",
    "query-head-shop",
    "query-get-event",
    "query-options-product",
    "late-register-get-home",
  ])("suppresses only Tickera wp_loaded session startup for %s", (scenario) => {
    const result = runScenario(scenario);

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(false);
    expect(result.sessionStartCalls).toBe(0);
    expectNeighborHooksUntouched(result);
  });

  it.each([
    "post-allowlist",
    "delete-allowlist",
    "missing-method",
    "lowercase-method",
    "whitespace-method",
    "pretty-trailing-slash",
    "cart-post",
    "unknown-route",
    "near-route-prefix",
    "nonnumeric-id",
    "dot-segment",
    "absolute-uri",
    "unknown-query-key",
    "duplicate-safe-query-key",
    "checkout-fields",
    "payment-route",
    "encoded-slash-pretty",
    "double-encoded-pretty",
    "malformed-percent",
    "repeated-slash",
    "duplicate-rest-route",
    "encoded-rest-route",
    "array-rest-route",
    "pretty-plus-query-route",
    "query-get-mismatch",
    "query-method-override",
    "header-method-override",
    "encoded-method-override",
    "array-method-override",
    "dot-route-alias",
    "encoded-route-key",
    "semicolon-query",
    "stateful-add-to-cart",
    "stateful-wc-ajax",
    "stateful-normalized-alias",
    "stateful-encoded-key",
    "stateful-cart-action",
  ])(
    "fails closed and preserves Tickera's session behavior for %s",
    (scenario) => {
      const result = runScenario(scenario);

      expect(result.allowlisted).toBe(false);
      expect(result.wpLoadedPriorityAfter).toBe(10);
      expect(result.sessionStartCalls).toBe(1);
      expectNeighborHooksUntouched(result);
    },
  );

  it("does not partially change the hook when removal fails", () => {
    const result = runScenario("remove-failure");

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(10);
    expect(result.sessionStartCalls).toBe(1);
    expectNeighborHooksUntouched(result);
  });

  it("requires Tickera's proven wp_loaded priority", () => {
    const result = runScenario("wrong-hook-priority");

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(11);
    expect(result.sessionStartCalls).toBe(1);
    expectNeighborHooksUntouched(result);
  });

  it("requires the independently qualified Tickera version", () => {
    const result = runScenario("wrong-tickera-version");

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(10);
    expect(result.sessionStartCalls).toBe(1);
    expectNeighborHooksUntouched(result);
  });

  it("keeps the source contract narrow and side-effect free", () => {
    const source = readFileSync(shim, "utf8");

    expect(source).toContain("has_action( 'wp_loaded', $callback )");
    expect(source).toContain("remove_action( 'wp_loaded', $callback, 10 )");
    expect(source).toContain("PHP_INT_MIN");
    expect(source).toContain("'HTTP_X_HTTP_METHOD_OVERRIDE'");
    expect(source).toContain("(string) $tc->version !== '3.6.0.2'");
    expect(source).not.toContain("'plugins_loaded'");
    expect(source).not.toMatch(/\bsession_start\s*\(/);
    expect(source).not.toMatch(/\bheader\s*\(/);
    expect(source).not.toMatch(/\bsetcookie\s*\(/);
    expect(source).not.toContain("admin_post_tickera_cart");
    expect(source).not.toContain("rest_pre_serve_request");
    expect(source).not.toContain("authenticate");
  });
});

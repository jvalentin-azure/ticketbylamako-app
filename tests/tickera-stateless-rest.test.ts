import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type HarnessResult = {
  scenario: string;
  allowlisted: boolean;
  restAllowlisted: boolean;
  publicHomeAllowlisted: boolean;
  guardRunsFirst: boolean;
  bridgeGuardRunsFirst: boolean;
  bridgeBlocksPriority: number | false;
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
  restoreCalls: number;
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
  expect(result.bridgeGuardRunsFirst).toBe(true);
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
    "public-home-get",
    "public-home-head",
    "public-home-fpm-head",
    "public-home-fpm-empty-cgi-fields",
    "pretty-get-home",
    "pretty-head-event",
    "pretty-options-product",
    "pretty-get-events",
    "pretty-get-shop",
    "pretty-head-rewards",
    "pretty-options-session",
    "pretty-get-session-auth-cookie",
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
    expect(result.bridgeBlocksPriority).toBe(false);
    expect(result.sessionStartCalls).toBe(0);
    expectNeighborHooksUntouched(result);
  });

  it.each([
    "public-home-get",
    "public-home-head",
    "public-home-fpm-head",
    "public-home-fpm-empty-cgi-fields",
  ])(
    "classifies only the passive anonymous homepage as public stateless for %s",
    (scenario) => {
      const result = runScenario(scenario);

      expect(result.restAllowlisted).toBe(false);
      expect(result.publicHomeAllowlisted).toBe(true);
      expect(result.allowlisted).toBe(true);
    },
  );

  it.each([
    "pretty-get-home",
    "pretty-head-event",
    "pretty-options-product",
    "query-get-home",
  ])(
    "keeps REST classification separate from public home for %s",
    (scenario) => {
      const result = runScenario(scenario);

      expect(result.restAllowlisted).toBe(true);
      expect(result.publicHomeAllowlisted).toBe(false);
      expect(result.allowlisted).toBe(true);
    },
  );

  it.each([
    "public-home-options",
    "public-home-query",
    "public-home-empty-query-marker",
    "public-home-index",
    "public-home-session-cookie",
    "public-home-active-session",
    "public-home-woocommerce-session",
    "public-home-woocommerce-cart",
    "public-home-auth-cookie",
    "public-home-post-data",
    "public-home-authorization",
    "public-home-php-auth-user",
    "public-home-remote-user",
    "public-home-upload",
    "public-home-content-length",
    "public-home-content-type",
    "public-home-transfer-encoding",
    "cart-get",
    "checkout-get",
    "payment-get",
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
      expect(result.bridgeBlocksPriority).toBe(10);
      expect(result.sessionStartCalls).toBe(2);
      expectNeighborHooksUntouched(result);
    },
  );

  it("does not partially change the hook when removal fails", () => {
    const result = runScenario("remove-failure");

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(10);
    expect(result.bridgeBlocksPriority).toBe(10);
    expect(result.sessionStartCalls).toBe(2);
    expectNeighborHooksUntouched(result);
  });

  it("restores the baseline when remove_action reports success but the hook remains", () => {
    const result = runScenario("remove-success-hook-remains");

    expect(result.allowlisted).toBe(true);
    expect(result.wpLoadedPriorityAfter).toBe(10);
    expect(result.bridgeBlocksPriority).toBe(10);
    expect(result.sessionStartCalls).toBe(2);
    expect(result.restoreCalls).toBe(1);
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
    expect(source).toContain("'HTTP_AUTHORIZATION'");
    expect(source).toContain("'PHP_AUTH_USER'");
    expect(source).toContain("'REMOTE_USER'");
    expect(source).toContain("session_status() !== PHP_SESSION_NONE");
    expect(source).toContain("'CONTENT_LENGTH'");
    expect(source).toContain("'CONTENT_TYPE'");
    expect(source).toContain("'HTTP_TRANSFER_ENCODING'");
    expect(source).toContain("'wp_woocommerce_session_'");
    expect(source).toContain("'woocommerce_items_in_cart'");
    expect(source).toContain("(string) $tc->version !== '3.6.0.2'");
    expect(source).toContain("'woocommerce_blocks_loaded'");
    expect(source).not.toMatch(
      /add_action\(\s*'plugins_loaded',\s*'tbl_tickera_stateless_disable_bridge_blocks_bootstrap'/,
    );
    expect(source).toContain("'init_block_integration'");
    expect(source).not.toMatch(/\bsession_start\s*\(/);
    expect(source).not.toMatch(/\bheader\s*\(/);
    expect(source).not.toMatch(/\bsetcookie\s*\(/);
    expect(source).not.toContain("admin_post_tickera_cart");
    expect(source).not.toContain("rest_pre_serve_request");
    expect(source).not.toContain("authenticate");
  });
});

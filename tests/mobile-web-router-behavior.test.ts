import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

type HarnessResult = {
  excluded: boolean;
  target: string;
  rendered: string;
  actions: unknown[];
};

type BrowserOptions = {
  userAgent?: string;
  phoneViewport?: boolean;
  query?: string;
  random?: number;
  localBucket?: string | null;
  localStorageUnavailable?: boolean;
  localStorageReadUnavailable?: boolean;
  localStorageWriteUnavailable?: boolean;
  desktopSession?: string | null;
  sessionStorageUnavailable?: boolean;
  sessionStorageReadUnavailable?: boolean;
  sessionStorageWriteUnavailable?: boolean;
  urlSearchParamsUnavailable?: boolean;
  matchMediaUnavailable?: boolean;
};

const harness = resolve("tests/php/mobile-web-router-harness.php");

function renderRouter(
  path: string,
  rollout: number | string = 100,
  singular = "none",
  id = 0,
  enabled = true,
  requestState = "none",
  requestMethod = "GET",
): HarnessResult {
  return JSON.parse(
    execFileSync(
      "php",
      [
        harness,
        path,
        String(rollout),
        singular,
        String(id),
        enabled ? "1" : "0",
        requestState,
        requestMethod,
      ],
      { encoding: "utf8" },
    ),
  ) as HarnessResult;
}

function executeRouter(rendered: string, options: BrowserOptions = {}) {
  const script = rendered.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  if (!script) throw new Error("Router script was not rendered");

  const replacements: string[] = [];
  const localWrites: [string, string][] = [];
  const sessionWrites: [string, string][] = [];
  let localReads = 0;
  let sessionReads = 0;
  let localBucket = options.localBucket ?? null;
  let desktopSession = options.desktopSession ?? null;

  const window = {
    location: {
      search: options.query ?? "",
      replace: (target: string) => replacements.push(target),
    },
    navigator: {
      userAgent:
        options.userAgent ??
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    },
    matchMedia: () => {
      if (options.matchMediaUnavailable)
        throw new Error("matchMedia unavailable");
      return { matches: options.phoneViewport ?? true };
    },
  } as Record<string, unknown>;

  Object.defineProperty(window, "localStorage", {
    get() {
      if (options.localStorageUnavailable)
        throw new Error("localStorage unavailable");
      return {
        getItem: () => {
          if (options.localStorageReadUnavailable)
            throw new Error("localStorage read unavailable");
          localReads += 1;
          return localBucket;
        },
        setItem: (key: string, value: string) => {
          if (options.localStorageWriteUnavailable)
            throw new Error("localStorage write unavailable");
          localWrites.push([key, value]);
          localBucket = value;
        },
      };
    },
  });

  Object.defineProperty(window, "sessionStorage", {
    get() {
      if (options.sessionStorageUnavailable)
        throw new Error("sessionStorage unavailable");
      return {
        getItem: () => {
          if (options.sessionStorageReadUnavailable)
            throw new Error("sessionStorage read unavailable");
          sessionReads += 1;
          return desktopSession;
        },
        setItem: (key: string, value: string) => {
          if (options.sessionStorageWriteUnavailable)
            throw new Error("sessionStorage write unavailable");
          sessionWrites.push([key, value]);
          desktopSession = value;
        },
      };
    },
  });

  const math = Object.create(Math) as Math;
  math.random = () => options.random ?? 0.42;
  runInNewContext(script, {
    window,
    URL,
    URLSearchParams: options.urlSearchParamsUnavailable
      ? undefined
      : URLSearchParams,
    Math: math,
  });

  return { replacements, localWrites, sessionWrites, localReads, sessionReads };
}

describe("mobile web router behavior", () => {
  it("maps the root and public deep links to the mobile experience", () => {
    expect(renderRouter("/").target).toBe("/mobile/");
    expect(renderRouter("/evenements/").target).toBe("/mobile/events");
    expect(renderRouter("/boutique/").target).toBe("/mobile/shop");
    expect(renderRouter("/mon-compte/").target).toBe("/mobile/profile");
    expect(renderRouter("/concert/", 100, "tc_events", 13771).target).toBe(
      "/mobile/event/13771",
    );
    expect(renderRouter("/livre/", 100, "product", 13845).target).toBe(
      "/mobile/product/13845",
    );
    expect(renderRouter("/livre/", 100, "product", 0).target).toBe(
      "/mobile/shop",
    );
    expect(renderRouter("/concert/", 100, "tc_events", -42).target).toBe(
      "/mobile/events",
    );
  });

  it.each([
    "/paiement/",
    "/paiement/order-pay/42/",
    "/cart/",
    "/cart/?removed_item=1",
    "/panier/",
    "/panier/remove-item/abc123/",
    "/checkout/",
    "/checkout-2/order-pay/42/",
    "/wp-admin/",
    "/wp-json/lamako-mobile/v2/public/home-data",
    "/order-pay/42/",
    "/order-received/42/",
    "/commande-recue/42/",
    "/commande/order-received/42/",
    "/thankyou/42/",
    "/wc-api/orange/callback",
    "/lamako-mobile/v2/payments/orange/callback",
    "/?lamako_checkout=1&order_id=42&order_key=test-order-key",
    "/?lamako_checkout_token=test-checkout-token",
    "/?lamako_seat_embed=1&chart_id=13771",
    "/?lamako_seating_checkout=test-seating-token",
    "/?lamako_seating_token=test-seating-token",
    "/?pay_for_order=true&key=test-order-key",
    "/?wc-api=WC_Gateway_Test",
    "/?wc_api=WC_Gateway_Test",
    "/?wc-ajax=get_refreshed_fragments",
    "/?add-to-cart=13845",
    "/?remove_item=abc123",
    "/?apply_coupon=SAVE10",
    "/?update_cart=Update",
    "/?LAMAKO_CHECKOUT=1",
    "/%70aiement/order-pay/42/",
    "/%2570aiement/order-pay/42/",
    "/%63art/",
    "/%2570anier/",
    "/checkout%2Forder-pay/42/",
  ])("fails closed for transactional or infrastructure path %s", (path) => {
    const result = renderRouter(path);
    expect(result.excluded).toBe(true);
    expect(result.rendered).toBe("");
  });

  it("does not render when the server-side feature flag is disabled", () => {
    expect(renderRouter("/", 100, "none", 0, false).rendered).toBe("");
  });

  it.each(["admin", "ajax", "rest", "feed", "robots", "trackback", "preview"])(
    "fails closed for the WordPress %s request state",
    (requestState) => {
      const result = renderRouter("/", 100, "none", 0, true, requestState);
      expect(result.excluded).toBe(true);
      expect(result.rendered).toBe("");
    },
  );

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])(
    "does not inject the browser router into a %s response",
    (method) => {
      expect(
        renderRouter("/", 100, "none", 0, true, "none", method).rendered,
      ).toBe("");
    },
  );

  it("redirects an iPhone at 100 percent without touching unavailable storage", () => {
    const result = executeRouter(renderRouter("/", 100).rendered, {
      localStorageUnavailable: true,
      sessionStorageUnavailable: true,
    });
    expect(result.replacements).toEqual([
      "https://staging.ticketbylamako.com/mobile/",
    ]);
    expect(result.localReads).toBe(0);
  });

  it("keeps rollout zero on WordPress without reading localStorage", () => {
    const result = executeRouter(renderRouter("/", 0).rendered, {
      localStorageUnavailable: true,
    });
    expect(result.replacements).toEqual([]);
    expect(result.localReads).toBe(0);
  });

  it.each([
    { configured: -100, expectedRedirect: false },
    { configured: -1, expectedRedirect: false },
    { configured: 0, expectedRedirect: false },
    { configured: 1, expectedRedirect: true },
    { configured: 99, expectedRedirect: true },
    { configured: 100, expectedRedirect: true },
    { configured: 101, expectedRedirect: true },
    { configured: "invalid", expectedRedirect: false },
  ])(
    "clamps rollout $configured without turning invalid or negative values into exposure",
    ({ configured, expectedRedirect }) => {
      const result = executeRouter(renderRouter("/", configured).rendered, {
        random: 0,
        localStorageUnavailable: configured === 100 || configured === 101,
      });
      expect(result.replacements.length > 0).toBe(expectedRedirect);
    },
  );

  it("creates and persists a real bucket for a new partial-rollout visitor", () => {
    const included = executeRouter(renderRouter("/", 50).rendered, {
      random: 0.42,
    });
    expect(included.localWrites).toEqual([
      ["ticketbylamako_mobile_web_bucket", "42"],
    ]);
    expect(included.replacements).toHaveLength(1);

    const excluded = executeRouter(renderRouter("/", 5).rendered, {
      random: 0.99,
    });
    expect(excluded.localWrites).toEqual([
      ["ticketbylamako_mobile_web_bucket", "99"],
    ]);
    expect(excluded.replacements).toEqual([]);
  });

  it("uses a valid persisted bucket and fails closed when partial-rollout storage is unavailable", () => {
    expect(
      executeRouter(renderRouter("/", 25).rendered, { localBucket: "12" })
        .replacements,
    ).toHaveLength(1);
    expect(
      executeRouter(renderRouter("/", 25).rendered, { localBucket: "80" })
        .replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 25).rendered, {
        localStorageUnavailable: true,
      }).replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 25).rendered, {
        localStorageReadUnavailable: true,
      }).replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 25).rendered, {
        localStorageWriteUnavailable: true,
      }).replacements,
    ).toEqual([]);
  });

  it.each(["42.5", "0x2a", "4.2e1", "", "   ", "not-a-number", "-1", "100"])(
    "replaces non-canonical persisted bucket %j with an integer bucket",
    (localBucket) => {
      const result = executeRouter(renderRouter("/", 75).rendered, {
        localBucket,
        random: 0.7,
      });
      expect(result.localWrites).toEqual([
        ["ticketbylamako_mobile_web_bucket", "70"],
      ]);
      expect(result.replacements).toHaveLength(1);
    },
  );

  it("redirects an Android browser even when its viewport is wider than the phone breakpoint", () => {
    const result = executeRouter(renderRouter("/", 100).rendered, {
      userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro)",
      phoneViewport: false,
    });
    expect(result.replacements).toEqual([
      "https://staging.ticketbylamako.com/mobile/",
    ]);
  });

  it("fails closed when required browser routing APIs are unavailable", () => {
    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        urlSearchParamsUnavailable: true,
      }).replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        matchMediaUnavailable: true,
      }).replacements,
    ).toEqual([]);
  });

  it("keeps desktops, bots and explicit classic-site requests on WordPress", () => {
    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        phoneViewport: false,
      }).replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        userAgent: "Googlebot/2.1",
      }).replacements,
    ).toEqual([]);

    const classic = executeRouter(renderRouter("/?desktop=1", 100).rendered, {
      query: "?desktop=1",
      sessionStorageWriteUnavailable: true,
    });
    expect(classic.replacements).toEqual([]);

    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        desktopSession: "1",
      }).replacements,
    ).toEqual([]);
    expect(
      executeRouter(renderRouter("/", 100).rendered, {
        sessionStorageReadUnavailable: true,
      }).replacements,
    ).toHaveLength(1);
  });

  it("keeps the source contract explicit for payment exclusions and safe bucketing", () => {
    const source = readFileSync(
      resolve("scripts/lamako-mobile-api/includes/mobile-web-router.php"),
      "utf8",
    );
    expect(source).toContain("'/paiement'");
    expect(source).toContain("'/cart'");
    expect(source).toContain("'/panier'");
    expect(source).toContain("$request_method !== 'GET'");
    expect(source).toContain("if (rolloutPercent < 100)");
    expect(source).toContain("/^(?:0|[1-9]\\d?)$/");
    expect(source).toContain("Number.isInteger(bucket)");
  });
});

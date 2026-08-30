import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  attributeWebKitRouterEvidence,
  classifyWebKitNetworkObservation,
  diagnoseWebKitContentBootstrap,
  evaluateWebKitClassicControl,
  evaluateWebKitNamedRouteControl,
  evaluateWebKitOnboardingSlide,
  evaluateWebKitPaymentNoFollow,
  evaluateWebKitRouterReleaseGate,
  evaluateWebKitScenarioGate,
  evaluateWebKitWordPressControlDebt,
  inspectWebKitEventContractText,
  runWithWebKitEvidence,
  WEBKIT_ROUTER_EVENT_FIXTURE,
  WEBKIT_ROUTER_ONBOARDING_FIXTURE,
  WEBKIT_REQUIRED_ROUTE_CONTROL_IDS,
  type WebKitNamedRouteControlEvidence,
  type WebKitPaymentNoFollowEvidence,
  type WebKitScenarioMetrics,
} from "../scripts/webkit-network-gate";

describe("WebKit network release gate", () => {
  it("reports a cancelled read-only API request without blocking the release", () => {
    expect(
      classifyWebKitNetworkObservation({
        method: "GET",
        url: "https://staging.ticketbylamako.com/wp-json/lamako-mobile/v2/rewards/config",
        resourceType: "fetch",
        status: null,
        errorText: "Load request cancelled",
        failureStep: "deep-refresh",
      }),
    ).toEqual({
      surface: "api-target",
      failureClass: "navigation-abort",
      blocking: false,
    });
  });

  it("classifies the configured production API host as the target origin", () => {
    expect(
      classifyWebKitNetworkObservation({
        method: "GET",
        url: "https://www.ticketbylamako.com/wp-json/lamako-mobile/v2/public/events/13459",
        expectedHost: "www.ticketbylamako.com",
        resourceType: "fetch",
        status: 200,
        errorText: null,
        failureStep: null,
      }),
    ).toEqual({
      surface: "api-target",
      failureClass: "none",
      blocking: false,
    });
  });

  it("reports a cancelled read-only image without blocking the release", () => {
    expect(
      classifyWebKitNetworkObservation({
        method: "GET",
        url: "https://staging.ticketbylamako.com/wp-content/uploads/event.webp",
        resourceType: "image",
        status: null,
        errorText: "Load request cancelled",
        failureStep: "deep-refresh",
      }),
    ).toEqual({
      surface: "image",
      failureClass: "navigation-abort",
      blocking: false,
    });
  });

  it.each([
    {
      name: "mutative cancellation",
      observation: {
        method: "POST",
        url: "https://staging.ticketbylamako.com/wp-json/example",
        resourceType: "fetch",
        status: null,
        errorText: "Load request cancelled",
        failureStep: "deep-refresh",
      },
      failureClass: "navigation-abort",
    },
    {
      name: "CORS failure",
      observation: {
        method: "GET",
        url: "https://staging.ticketbylamako.com/wp-json/example",
        resourceType: "fetch",
        status: null,
        errorText: "Blocked due to access control checks",
        failureStep: "initial-navigation",
      },
      failureClass: "CORS",
    },
    {
      name: "TLS failure",
      observation: {
        method: "GET",
        url: "https://staging.ticketbylamako.com/mobile/",
        resourceType: "document",
        status: null,
        errorText: "SSL certificate error",
        failureStep: "initial-navigation",
      },
      failureClass: "TLS",
    },
    {
      name: "HTTP failure",
      observation: {
        method: "GET",
        url: "https://staging.ticketbylamako.com/mobile/app.js",
        resourceType: "script",
        status: 500,
        errorText: null,
        failureStep: null,
      },
      failureClass: "HTTP",
    },
  ])("blocks $name", ({ observation, failureClass }) => {
    expect(classifyWebKitNetworkObservation(observation)).toMatchObject({
      failureClass,
      blocking: true,
    });
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "accepts a %s cancellation only inside a correlated refresh window",
    (method) => {
      const observation = {
        method,
        url: "https://staging.ticketbylamako.com/wp-json/example",
        resourceType: "fetch",
        status: null,
        errorText: "Load request cancelled",
      };

      expect(
        classifyWebKitNetworkObservation({
          ...observation,
          failureStep: "deep-refresh",
        }).blocking,
      ).toBe(false);
      expect(
        classifyWebKitNetworkObservation({
          ...observation,
          failureStep: "initial-event-wait",
        }).blocking,
      ).toBe(true);
    },
  );

  it("keeps a cancellation blocking after an HTTP response was observed", () => {
    expect(
      classifyWebKitNetworkObservation({
        method: "GET",
        url: "https://staging.ticketbylamako.com/mobile/event/13459",
        resourceType: "document",
        status: 200,
        errorText: "Load request cancelled",
        failureStep: "initial-navigation",
      }),
    ).toMatchObject({ failureClass: "navigation-abort", blocking: true });
  });

  it("accepts a read-only cancellation only during an explicit navigation transition", () => {
    const observation = {
      method: "GET",
      url: "https://staging.ticketbylamako.com/mobile/event/13459",
      resourceType: "image",
      status: null,
      errorText: "Load request cancelled",
    };

    expect(
      classifyWebKitNetworkObservation({
        ...observation,
        failureStep: "navigation-transition",
      }).blocking,
    ).toBe(false);
    expect(
      classifyWebKitNetworkObservation({
        ...observation,
        failureStep: "event-detail",
      }).blocking,
    ).toBe(true);
  });

  it.each(["DNS lookup failed", "Connection reset", "Connection refused"])(
    "blocks transport failure: %s",
    (errorText) => {
      expect(
        classifyWebKitNetworkObservation({
          method: "GET",
          url: "https://staging.ticketbylamako.com/wp-json/example",
          resourceType: "fetch",
          status: null,
          errorText,
          failureStep: "deep-refresh",
        }),
      ).toMatchObject({ failureClass: "network", blocking: true });
    },
  );
});

describe("mobile router evidence attribution", () => {
  const forbiddenWordPressAsset = {
    method: "GET",
    url: "https://staging.ticketbylamako.com/wp-content/plugins/cafe-events-carousel/assets/front.js",
    resourceType: "script",
    status: 403,
    errorText: null,
    failureStep: "desktop-control",
  };

  it("keeps a WordPress control-page 403 visible without blaming the candidate", () => {
    expect(
      attributeWebKitRouterEvidence(
        forbiddenWordPressAsset,
        "wordpress-control",
      ),
    ).toMatchObject({
      releaseImpact: "wordpress-control-debt",
      classification: { failureClass: "HTTP", blocking: true },
    });
  });

  it("blocks the same 403 when it belongs to the mobile app scenario", () => {
    expect(
      attributeWebKitRouterEvidence(forbiddenWordPressAsset, "mobile-app"),
    ).toMatchObject({ releaseImpact: "candidate-blocker" });
  });

  it("attributes intercepted mutations to the page surface that attempted them", () => {
    const mutation = {
      method: "POST",
      url: "https://staging.ticketbylamako.com/",
      resourceType: "xhr",
      status: null,
      errorText: "Blocked by Web Inspector",
      failureStep: "desktop-control",
    };

    expect(
      attributeWebKitRouterEvidence(mutation, "wordpress-control"),
    ).toMatchObject({ releaseImpact: "wordpress-control-debt" });
    expect(attributeWebKitRouterEvidence(mutation, "mobile-app")).toMatchObject(
      { releaseImpact: "candidate-blocker" },
    );
  });

  it("reports correlated navigation cancellations without hiding real failures", () => {
    expect(
      attributeWebKitRouterEvidence(
        {
          method: "GET",
          url: "https://staging.ticketbylamako.com/mobile/app.js",
          resourceType: "script",
          status: null,
          errorText: "Load request cancelled",
          failureStep: "navigation-transition",
        },
        "mobile-app",
      ),
    ).toMatchObject({ releaseImpact: "expected-navigation" });
  });
});

describe("mobile router event fixture", () => {
  it("pins the event contract that previously passed the exact bundle QA", () => {
    expect(WEBKIT_ROUTER_EVENT_FIXTURE).toEqual({
      id: 13459,
      path: "/mobile/event/13459",
      title: "Lamako Acoustique #2 – Olombelo Ricky",
    });
    expect(
      inspectWebKitEventContractText(
        "Lamako Acoustique #2 – Olombelo Ricky Date 27 juin 2026",
      ),
    ).toEqual({
      titlePresent: true,
      date27JunePresent: true,
      publicationDate3MayPresent: false,
      pass: true,
    });
  });

  it.each([
    ["wrong event", "Another event Date 27 juin 2026"],
    [
      "publication date",
      "Lamako Acoustique #2 – Olombelo Ricky Date 27 juin 2026 Publié le 3 mai 2026",
    ],
    ["missing date", "Lamako Acoustique #2 – Olombelo Ricky"],
  ])("fails closed for %s", (_name, text) => {
    expect(inspectWebKitEventContractText(text).pass).toBe(false);
  });

  it("does not confuse 13 May or 127 June with the gated dates", () => {
    expect(
      inspectWebKitEventContractText(
        "Lamako Acoustique #2 – Olombelo Ricky Date 127 juin 2026, publié le 13 mai 2026",
      ),
    ).toEqual({
      titlePresent: true,
      date27JunePresent: false,
      publicationDate3MayPresent: false,
      pass: false,
    });
  });
});

describe("mobile router content bootstrap", () => {
  it("pins the same onboarding state as the application bundle", () => {
    expect(WEBKIT_ROUTER_ONBOARDING_FIXTURE).toEqual({
      storageKey: "@ticketbylamako/onboarding-version",
      version: "2",
      skipLabel: "Passer",
    });

    const layout = readFileSync(path.resolve("app/_layout.tsx"), "utf8");
    expect(layout).toContain('"@ticketbylamako/onboarding-version"');
    expect(layout).toContain('const ONBOARDING_VERSION = "2"');
  });

  it.each([
    [
      "ready",
      {
        onboardingAssetRequests: 0,
        eventApiRequests: 2,
        eventContractReached: true,
      },
      "ready",
    ],
    [
      "fresh context stopped on onboarding",
      {
        onboardingAssetRequests: 2,
        eventApiRequests: 0,
        eventContractReached: false,
      },
      "blocked-by-onboarding",
    ],
    [
      "application mounted without starting an API",
      {
        onboardingAssetRequests: 0,
        eventApiRequests: 0,
        eventContractReached: false,
      },
      "api-not-started",
    ],
    [
      "API returned but the contract did not render",
      {
        onboardingAssetRequests: 0,
        eventApiRequests: 2,
        eventContractReached: false,
      },
      "event-contract-failure",
    ],
    [
      "inconsistent cached text without an event API",
      {
        onboardingAssetRequests: 0,
        eventApiRequests: 0,
        eventContractReached: true,
      },
      "api-not-started",
    ],
  ] as const)("diagnoses %s", (_name, evidence, expected) => {
    expect(diagnoseWebKitContentBootstrap(evidence)).toBe(expected);
  });
});

describe("mobile router onboarding evidence", () => {
  const renderedImage = {
    elementPresent: true,
    complete: true,
    naturalWidth: 1170,
    naturalHeight: 2532,
    visibleWidth: 393,
    visibleHeight: 852,
    intersectionRatio: 1,
  };

  const slide1 = {
    slideId: "1" as const,
    activeSlideIndex: 0,
    renderedText: "Prenez place. Vivez grand. Suivant",
    image: renderedImage,
  };

  it("accepts a slide only when its text, action and viewport image are rendered", () => {
    expect(
      evaluateWebKitOnboardingSlide({
        ...slide1,
        renderedText: "  Prenez place.\nVivez grand.   Suivant ",
      }),
    ).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it("fails closed for an unknown runtime slide identity", () => {
    expect(
      evaluateWebKitOnboardingSlide({
        ...slide1,
        slideId: "3" as never,
      }),
    ).toEqual({ pass: false, reasons: ["slide_identity_unknown"] });
  });

  it.each([
    [
      "missing title",
      { ...slide1, renderedText: "Suivant" },
      "slide_title_not_visible",
    ],
    [
      "missing action",
      { ...slide1, renderedText: "Prenez place. Vivez grand." },
      "slide_action_not_visible",
    ],
    [
      "wrong active slide",
      { ...slide1, activeSlideIndex: 1 },
      "slide_identity_mismatch",
    ],
    [
      "missing image element",
      {
        ...slide1,
        image: { ...renderedImage, elementPresent: false },
      },
      "slide_image_missing",
    ],
    [
      "image not loaded",
      {
        ...slide1,
        image: { ...renderedImage, complete: false, naturalWidth: 0 },
      },
      "slide_image_not_loaded",
    ],
    [
      "image outside viewport",
      {
        ...slide1,
        image: { ...renderedImage, intersectionRatio: 0 },
      },
      "slide_image_not_in_viewport",
    ],
    [
      "non-finite dimensions",
      {
        ...slide1,
        image: { ...renderedImage, naturalWidth: Number.NaN },
      },
      "slide_image_not_loaded",
    ],
    [
      "string false element flag",
      {
        ...slide1,
        image: { ...renderedImage, elementPresent: "false" as never },
      },
      "slide_image_missing",
    ],
    [
      "string false complete flag",
      {
        ...slide1,
        image: { ...renderedImage, complete: "false" as never },
      },
      "slide_image_not_loaded",
    ],
  ] as const)("fails closed for %s", (_name, evidence, expectedReason) => {
    expect(evaluateWebKitOnboardingSlide(evidence)).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([expectedReason]),
    });
  });
});

describe("mobile router classic controls", () => {
  const classicRoot = {
    controlId: "desktop-root" as const,
    finalUrl: "https://staging.ticketbylamako.com/",
    expectedOrigin: "https://staging.ticketbylamako.com",
    markerCount: 1,
    mobileDocumentRequests: 0,
    routerReplacementAttempts: 0,
  };

  it("allows the cache-safe marker when desktop stays on WordPress", () => {
    expect(evaluateWebKitClassicControl(classicRoot)).toEqual({
      pass: true,
      reasons: [],
      markerCount: 1,
    });
  });

  it("accepts the classic empty-cart redirect without routing to mobile", () => {
    expect(
      evaluateWebKitClassicControl({
        ...classicRoot,
        controlId: "payment-return",
        finalUrl: "https://staging.ticketbylamako.com/cart/",
        markerCount: 0,
      }),
    ).toEqual({ pass: true, reasons: [], markerCount: 0 });
  });

  it.each([
    ["mobile path", "https://staging.ticketbylamako.com/mobile/cart", 0, 0],
    [
      "encoded mobile path",
      "https://staging.ticketbylamako.com/%6dobile/cart",
      0,
      0,
    ],
    [
      "double-encoded mobile path",
      "https://staging.ticketbylamako.com/%256dobile/cart",
      0,
      0,
    ],
    [
      "encoded slash mobile path",
      "https://staging.ticketbylamako.com/%2fmobile/cart",
      0,
      0,
    ],
    ["mobile document", "https://staging.ticketbylamako.com/cart/", 1, 0],
    ["replacement attempt", "https://staging.ticketbylamako.com/cart/", 0, 1],
  ])(
    "fails closed for %s",
    (_name, finalPath, mobileDocuments, replacements) => {
      expect(
        evaluateWebKitClassicControl({
          ...classicRoot,
          finalUrl: finalPath,
          markerCount: 1,
          mobileDocumentRequests: mobileDocuments,
          routerReplacementAttempts: replacements,
        }).pass,
      ).toBe(false);
    },
  );

  it.each([
    ["empty URL", "", "https://staging.ticketbylamako.com"],
    ["malformed URL", "not a URL", "https://staging.ticketbylamako.com"],
    [
      "off-origin URL",
      "https://www.ticketbylamako.com/",
      "https://staging.ticketbylamako.com",
    ],
  ])("fails closed for %s", (_name, finalUrl, expectedOrigin) => {
    expect(
      evaluateWebKitClassicControl({
        ...classicRoot,
        finalUrl,
        expectedOrigin,
      }).pass,
    ).toBe(false);
  });

  it("fails closed for malformed counters", () => {
    expect(
      evaluateWebKitClassicControl({
        ...classicRoot,
        mobileDocumentRequests: Number.NaN,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["classic_control_metrics_invalid"]),
    });
  });

  it("fails closed for an unknown runtime control identity", () => {
    expect(
      evaluateWebKitClassicControl({
        ...classicRoot,
        controlId: "unknown" as never,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["classic_control_identity_unknown"]),
    });
  });

  it.each([
    [
      "desktop path drift",
      {
        ...classicRoot,
        finalUrl: "https://staging.ticketbylamako.com/events/",
      },
    ],
    [
      "explicit classic query missing",
      {
        ...classicRoot,
        controlId: "explicit-classic" as const,
        finalUrl: "https://staging.ticketbylamako.com/",
      },
    ],
    [
      "payment return path drift",
      {
        ...classicRoot,
        controlId: "payment-return" as const,
        finalUrl: "https://staging.ticketbylamako.com/events/",
        markerCount: 0,
      },
    ],
    ["duplicate desktop marker", { ...classicRoot, markerCount: 2 }],
  ])("fails closed for %s", (_name, control) => {
    expect(evaluateWebKitClassicControl(control).pass).toBe(false);
  });
});

describe("named mobile router controls", () => {
  const expectedOrigin = "https://staging.ticketbylamako.com";
  const paths = {
    "iphone-root": "/mobile/",
    "iphone-events": "/mobile/events",
    "iphone-shop": "/mobile/shop",
    "iphone-product": "/mobile/product/13845",
    "direct-mobile": "/mobile/",
    "admin-exclusion": "/wp-admin/",
    "login-exclusion": "/wp-login.php",
    "checkout-exclusion": "/cart/",
    "callback-exclusion": "/wp-json/lamako-mobile/v2/payments/orange/callback",
    "encoded-exclusion": "/%2570aiement/",
  } as const;
  const initialPaths = {
    "iphone-root": "/",
    "iphone-events": "/events/",
    "iphone-shop": "/shop/",
    "iphone-product": "/?p=13845",
    "direct-mobile": "/mobile/",
    "admin-exclusion": "/wp-admin/",
    "login-exclusion": "/wp-login.php",
    "checkout-exclusion": "/cart/",
    "callback-exclusion": "/wp-json/lamako-mobile/v2/payments/orange/callback",
    "encoded-exclusion": "/%2570aiement/",
  } as const;

  const createControl = (
    controlId: (typeof WEBKIT_REQUIRED_ROUTE_CONTROL_IDS)[number],
  ): WebKitNamedRouteControlEvidence => ({
    controlId,
    initialUrl: `${expectedOrigin}${initialPaths[controlId]}`,
    finalUrl: `${expectedOrigin}${paths[controlId]}`,
    userAgentClass: "iphone",
    userAgentRaw:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    viewportWidth: 393,
    initialRouterMarkerCount: controlId.startsWith("iphone-") ? 1 : 0,
    httpStatus: 200,
    routerReplacementAttempts: controlId.startsWith("iphone-") ? 1 : 0,
    mutationAttempts: 0,
    transmittedMutations: 0,
    consoleErrors: 0,
    pageErrors: 0,
    serviceWorkerRegistrations: 0,
  });

  it("passes the complete expected route contract one control at a time", () => {
    for (const controlId of WEBKIT_REQUIRED_ROUTE_CONTROL_IDS) {
      expect(evaluateWebKitNamedRouteControl(createControl(controlId))).toEqual(
        { pass: true, reasons: [] },
      );
    }
  });

  it.each([
    ["httpStatus", 403, "route_control_http_error"],
    ["mutationAttempts", 1, "route_control_mutation_attempt"],
    ["transmittedMutations", 1, "route_control_mutation_transmitted"],
    ["consoleErrors", 1, "route_control_console_error"],
    ["pageErrors", 1, "route_control_page_error"],
    ["serviceWorkerRegistrations", 1, "route_control_service_worker"],
  ] as const)("blocks a non-zero %s", (field, value, reason) => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("direct-mobile"),
        [field]: value,
      }),
    ).toMatchObject({ pass: false, reasons: expect.arrayContaining([reason]) });
  });

  it("blocks off-origin, path drift and invalid replacement evidence", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("iphone-events"),
        finalUrl: "https://www.ticketbylamako.com/mobile/shop",
        routerReplacementAttempts: 0,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "route_control_origin_mismatch",
        "mobile_route_contract_mismatch",
        "mobile_route_replacement_mismatch",
      ]),
    });
  });

  it("requires the exact double-encoded exclusion fixture", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("encoded-exclusion"),
        initialUrl: `${expectedOrigin}/cart/`,
        finalUrl: `${expectedOrigin}/cart/`,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "encoded_exclusion_contract_mismatch",
        "route_control_initial_path_mismatch",
      ]),
    });
  });

  it("rejects desktop opt-out and an unpinned product request", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("iphone-root"),
        initialUrl: `${expectedOrigin}/?desktop=1`,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["route_control_initial_query_mismatch"]),
    });
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("iphone-product"),
        initialUrl: `${expectedOrigin}/product/not-the-qa-product/`,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "route_control_initial_path_mismatch",
        "route_control_initial_query_mismatch",
      ]),
    });
  });

  it("rejects a mislabeled raw user agent", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("iphone-root"),
        userAgentRaw: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "route_control_raw_user_agent_mismatch",
      ]),
    });
  });

  it.each([
    ["admin boundary", "admin-exclusion", "/wp-admin-evil/"],
    [
      "callback boundary",
      "callback-exclusion",
      "/wp-json/not-a-callback-placeholder/",
    ],
  ] as const)("rejects a broad %s match", (_name, controlId, path) => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl(controlId),
        initialUrl: `${expectedOrigin}${path}`,
        finalUrl: `${expectedOrigin}${path}`,
      }).pass,
    ).toBe(false);
  });

  it("blocks replacement attempts on every excluded or direct route", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("checkout-exclusion"),
        routerReplacementAttempts: 1,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "excluded_route_replacement_unexpected",
      ]),
    });
  });

  it("fails closed for unknown runtime identities", () => {
    expect(
      evaluateWebKitNamedRouteControl({
        ...createControl("direct-mobile"),
        controlId: "unknown" as never,
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["route_control_identity_unknown"]),
    });
  });
});

describe("payment no-follow control", () => {
  const clean: WebKitPaymentNoFollowEvidence = {
    requestedUrl: "https://staging.ticketbylamako.com/paiement/",
    method: "GET",
    status: 302,
    location: "/cart/",
    responseBodyBytes: 0,
    responseBodyContainsRouter: false,
    routerMarkerCount: 0,
    mutationAttempts: 0,
    transmittedMutations: 0,
  };

  it("passes only the exact empty-cart redirect without router evidence", () => {
    expect(evaluateWebKitPaymentNoFollow(clean)).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it.each([
    ["status", 200, "payment_status_mismatch"],
    ["responseBodyContainsRouter", true, "payment_body_contains_router"],
    ["routerMarkerCount", 1, "payment_router_marker_present"],
    ["mutationAttempts", 1, "payment_mutation_attempt"],
    ["transmittedMutations", 1, "payment_mutation_transmitted"],
  ] as const)("blocks invalid %s", (field, value, reason) => {
    expect(evaluateWebKitPaymentNoFollow({ ...clean, [field]: value })).toEqual(
      { pass: false, reasons: [reason] },
    );
  });

  it("blocks off-origin and non-cart redirect locations", () => {
    expect(
      evaluateWebKitPaymentNoFollow({
        ...clean,
        location: "https://www.ticketbylamako.com/mobile/",
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["payment_location_mismatch"]),
    });
  });

  it("blocks a cart Location carrying query or fragment data", () => {
    expect(
      evaluateWebKitPaymentNoFollow({
        ...clean,
        location: "/cart/?continue=1#mobile",
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining(["payment_location_mismatch"]),
    });
  });
});

describe("WordPress control environment gate", () => {
  const clean = {
    cafeAsset403: 0,
    otherHttpErrors: 0,
    consoleIssues: 0,
    pageErrors: 0,
    mutationAttempts: 0,
    transmittedMutations: 0,
    serviceWorkerRegistrations: 0,
  };

  it("passes only a clean WordPress control surface", () => {
    expect(evaluateWebKitWordPressControlDebt(clean)).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it.each([
    ["cafeAsset403", "cafe_events_carousel_403"],
    ["otherHttpErrors", "wordpress_http_error"],
    ["consoleIssues", "wordpress_console_issue"],
    ["pageErrors", "wordpress_page_error"],
    ["mutationAttempts", "wordpress_mutation_attempt"],
    ["transmittedMutations", "wordpress_mutation_transmitted"],
    ["serviceWorkerRegistrations", "wordpress_service_worker_registered"],
  ] as const)("keeps %s release-blocking", (field, reason) => {
    expect(
      evaluateWebKitWordPressControlDebt({ ...clean, [field]: 1 }),
    ).toEqual({ pass: false, reasons: [reason] });
  });
});

describe("composed mobile router release gate", () => {
  const cleanContent = {
    stabilized: true,
    blockingNetworkFailures: 0,
    httpErrors: 0,
    mutations: 0,
    transmittedMutations: 0,
    serviceWorkerRegistrations: 0,
    hashRequests: 0,
    consoleErrors: 0,
    pageErrors: 0,
    invalidApiResponses: 0,
    horizontalOverflow: false,
    date27JunePresent: true,
    publicationDate3MayPresent: false,
    deepRefreshPass: true,
  };
  const image = {
    elementPresent: true,
    complete: true,
    naturalWidth: 1170,
    naturalHeight: 2532,
    visibleWidth: 393,
    visibleHeight: 852,
    intersectionRatio: 1,
  };
  const controls = [
    {
      controlId: "desktop-root" as const,
      finalUrl: "https://staging.ticketbylamako.com/",
      expectedOrigin: "https://staging.ticketbylamako.com",
      markerCount: 1,
      mobileDocumentRequests: 0,
      routerReplacementAttempts: 0,
    },
    {
      controlId: "explicit-classic" as const,
      finalUrl: "https://staging.ticketbylamako.com/?desktop=1",
      expectedOrigin: "https://staging.ticketbylamako.com",
      markerCount: 1,
      mobileDocumentRequests: 0,
      routerReplacementAttempts: 0,
    },
    {
      controlId: "payment-return" as const,
      finalUrl: "https://staging.ticketbylamako.com/cart/",
      expectedOrigin: "https://staging.ticketbylamako.com",
      markerCount: 0,
      mobileDocumentRequests: 0,
      routerReplacementAttempts: 0,
    },
  ];
  const routePaths = {
    "iphone-root": "/mobile/",
    "iphone-events": "/mobile/events",
    "iphone-shop": "/mobile/shop",
    "iphone-product": "/mobile/product/13845",
    "direct-mobile": "/mobile/",
    "admin-exclusion": "/wp-admin/",
    "login-exclusion": "/wp-login.php",
    "checkout-exclusion": "/cart/",
    "callback-exclusion": "/wp-json/lamako-mobile/v2/payments/orange/callback",
    "encoded-exclusion": "/%2570aiement/",
  } as const;
  const routeInitialPaths = {
    "iphone-root": "/",
    "iphone-events": "/events/",
    "iphone-shop": "/shop/",
    "iphone-product": "/?p=13845",
    "direct-mobile": "/mobile/",
    "admin-exclusion": "/wp-admin/",
    "login-exclusion": "/wp-login.php",
    "checkout-exclusion": "/cart/",
    "callback-exclusion": "/wp-json/lamako-mobile/v2/payments/orange/callback",
    "encoded-exclusion": "/%2570aiement/",
  } as const;
  const routeControls = WEBKIT_REQUIRED_ROUTE_CONTROL_IDS.map(
    (controlId): WebKitNamedRouteControlEvidence => ({
      controlId,
      initialUrl: `https://staging.ticketbylamako.com${routeInitialPaths[controlId]}`,
      finalUrl: `https://staging.ticketbylamako.com${routePaths[controlId]}`,
      userAgentClass: "iphone",
      userAgentRaw:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      viewportWidth: 393,
      initialRouterMarkerCount: controlId.startsWith("iphone-") ? 1 : 0,
      httpStatus: 200,
      routerReplacementAttempts: controlId.startsWith("iphone-") ? 1 : 0,
      mutationAttempts: 0,
      transmittedMutations: 0,
      consoleErrors: 0,
      pageErrors: 0,
      serviceWorkerRegistrations: 0,
    }),
  );
  const evidence = {
    contentScenario: cleanContent,
    onboardingSlides: [
      {
        slideId: "1" as const,
        activeSlideIndex: 0,
        renderedText: "Prenez place. Vivez grand. Suivant",
        image,
      },
      {
        slideId: "2" as const,
        activeSlideIndex: 1,
        renderedText: "Votre prochain souvenir commence ici. Découvrir",
        image,
      },
    ],
    classicControls: controls,
    routeControls,
    paymentNoFollow: {
      requestedUrl: "https://staging.ticketbylamako.com/paiement/",
      method: "GET" as const,
      status: 302,
      location: "/cart/",
      responseBodyBytes: 0,
      responseBodyContainsRouter: false,
      routerMarkerCount: 0,
      mutationAttempts: 0,
      transmittedMutations: 0,
    },
    wordpressControl: {
      cafeAsset403: 0,
      otherHttpErrors: 0,
      consoleIssues: 0,
      pageErrors: 0,
      mutationAttempts: 0,
      transmittedMutations: 0,
      serviceWorkerRegistrations: 0,
    },
  };

  it("passes only when content, both slides, all classic controls and WordPress are clean", () => {
    expect(evaluateWebKitRouterReleaseGate(evidence)).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it("fails closed when a required evidence set is absent", () => {
    expect(
      evaluateWebKitRouterReleaseGate({
        ...evidence,
        onboardingSlides: evidence.onboardingSlides.slice(0, 1),
        classicControls: evidence.classicControls.slice(0, 2),
        routeControls: evidence.routeControls.slice(0, 9),
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "onboarding:2:evidence_count_invalid",
        "classic:payment-return:evidence_count_invalid",
        "route:encoded-exclusion:evidence_count_invalid",
      ]),
    });
  });

  it("fails closed when the payment no-follow proof is invalid", () => {
    expect(
      evaluateWebKitRouterReleaseGate({
        ...evidence,
        paymentNoFollow: { ...evidence.paymentNoFollow, status: 200 },
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "payment-no-follow:payment_status_mismatch",
      ]),
    });
  });

  it("fails closed for string boolean values from runtime evidence", () => {
    expect(
      evaluateWebKitRouterReleaseGate({
        ...evidence,
        contentScenario: {
          ...cleanContent,
          stabilized: "false" as never,
          date27JunePresent: "false" as never,
          deepRefreshPass: "false" as never,
        },
        onboardingSlides: [
          {
            ...evidence.onboardingSlides[0],
            image: {
              ...evidence.onboardingSlides[0].image,
              complete: "false" as never,
            },
          },
          evidence.onboardingSlides[1],
        ],
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "content:scenario_not_stabilized",
        "content:contract_date_missing",
        "content:deep_refresh_failed",
        "onboarding:1:slide_image_not_loaded",
      ]),
    });
  });

  it("rejects valid evidence sets padded with unknown runtime identities", () => {
    expect(
      evaluateWebKitRouterReleaseGate({
        ...evidence,
        onboardingSlides: [
          ...evidence.onboardingSlides,
          { ...evidence.onboardingSlides[0], slideId: "3" as never },
        ],
        classicControls: [
          ...evidence.classicControls,
          {
            ...evidence.classicControls[0],
            controlId: "unknown" as never,
            finalUrl: "https://staging.ticketbylamako.com/mobile/",
          },
        ],
        routeControls: [
          ...evidence.routeControls,
          { ...evidence.routeControls[0], controlId: "unknown" as never },
        ],
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "onboarding:evidence_set_invalid",
        "onboarding:identity_unknown",
        "classic:evidence_set_invalid",
        "classic:identity_unknown",
        "route:evidence_set_invalid",
        "route:identity_unknown",
      ]),
    });
  });

  it("composes every component failure into the final verdict", () => {
    expect(
      evaluateWebKitRouterReleaseGate({
        ...evidence,
        contentScenario: { ...cleanContent, httpErrors: 1 },
        onboardingSlides: [
          { ...evidence.onboardingSlides[0], activeSlideIndex: 1 },
          evidence.onboardingSlides[1],
        ],
        classicControls: [
          ...controls.slice(0, 2),
          {
            ...controls[2],
            finalUrl: "https://staging.ticketbylamako.com/mobile/cart",
          },
        ],
        wordpressControl: {
          ...evidence.wordpressControl,
          cafeAsset403: 2,
        },
        routeControls: evidence.routeControls.map((control) =>
          control.controlId === "checkout-exclusion"
            ? { ...control, routerReplacementAttempts: 1 }
            : control,
        ),
      }),
    ).toMatchObject({
      pass: false,
      reasons: expect.arrayContaining([
        "content:http_error",
        "onboarding:1:slide_identity_mismatch",
        "classic:payment-return:classic_control_routed_to_mobile",
        "wordpress:cafe_events_carousel_403",
        "route:checkout-exclusion:excluded_route_replacement_unexpected",
      ]),
    });
  });
});

describe("WebKit evidence persistence", () => {
  it("writes the latest report in finally before propagating a gate failure", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "tbl-webkit-evidence-"),
    );
    const reportPath = path.join(temporaryDirectory, "qa-report.json");
    try {
      await expect(
        runWithWebKitEvidence(
          reportPath,
          { result: "RUNNING", blockingNetworkFailures: -1 },
          async (setReport) => {
            setReport({ result: "RUNNING", blockingNetworkFailures: 1 });
            throw new Error("blocking network failure");
          },
        ),
      ).rejects.toThrow("blocking network failure");

      expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual({
        result: "FAIL",
        blockingNetworkFailures: 1,
        error: "blocking network failure",
      });
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

describe("stabilized WebKit scenario gate", () => {
  const passingMetrics: WebKitScenarioMetrics = {
    stabilized: true,
    blockingNetworkFailures: 0,
    httpErrors: 0,
    mutations: 0,
    transmittedMutations: 0,
    serviceWorkerRegistrations: 0,
    hashRequests: 0,
    consoleErrors: 0,
    pageErrors: 0,
    invalidApiResponses: 0,
    horizontalOverflow: false,
    date27JunePresent: true,
    publicationDate3MayPresent: false,
    deepRefreshPass: true,
  };

  it("passes only the complete stabilized zero-error contract", () => {
    expect(evaluateWebKitScenarioGate(passingMetrics)).toEqual({
      pass: true,
      reasons: [],
    });
  });

  it.each([
    ["stabilized", false, "scenario_not_stabilized"],
    ["blockingNetworkFailures", 1, "blocking_network_failure"],
    ["httpErrors", 1, "http_error"],
    ["mutations", 1, "mutation"],
    ["transmittedMutations", 1, "mutation_transmitted"],
    ["serviceWorkerRegistrations", 1, "service_worker_registered"],
    ["hashRequests", 1, "blurhash_request"],
    ["consoleErrors", 1, "console_error"],
    ["pageErrors", 1, "page_error"],
    ["invalidApiResponses", 1, "invalid_api_response"],
    ["horizontalOverflow", true, "horizontal_overflow"],
    ["date27JunePresent", false, "contract_date_missing"],
    ["publicationDate3MayPresent", true, "publication_date_rendered"],
    ["deepRefreshPass", false, "deep_refresh_failed"],
  ] as const)("blocks %s", (key, value, reason) => {
    expect(
      evaluateWebKitScenarioGate({ ...passingMetrics, [key]: value }),
    ).toEqual({ pass: false, reasons: [reason] });
  });
});

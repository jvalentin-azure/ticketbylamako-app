import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  attributeWebKitRouterEvidence,
  classifyWebKitNetworkObservation,
  evaluateWebKitScenarioGate,
  inspectWebKitEventContractText,
  runWithWebKitEvidence,
  WEBKIT_ROUTER_EVENT_FIXTURE,
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

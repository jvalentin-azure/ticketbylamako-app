import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyWebKitNetworkObservation,
  evaluateWebKitScenarioGate,
  runWithWebKitEvidence,
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
      surface: "api-staging",
      failureClass: "navigation-abort",
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

describe("WebKit evidence persistence", () => {
  it("writes the latest report in finally before propagating a gate failure", async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tbl-webkit-evidence-"));
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

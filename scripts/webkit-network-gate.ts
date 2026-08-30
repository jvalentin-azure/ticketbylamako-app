import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type WebKitNetworkObservation = {
  method: string;
  url: string;
  expectedHost?: string;
  resourceType: string;
  status: number | null;
  errorText: string | null;
  failureStep: string | null;
};

export type WebKitNetworkClassification = {
  surface:
    | "app-static"
    | "api-target"
    | "image"
    | "third-party"
    | "target-other"
    | "unknown";
  failureClass:
    | "none"
    | "navigation-abort"
    | "CORS"
    | "TLS"
    | "HTTP"
    | "network";
  blocking: boolean;
};

const defaultTargetHost = "staging.ticketbylamako.com";
const readOnlyMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const expectedCancellationSteps = new Set([
  "initial-navigation",
  "deep-refresh",
  "navigation-transition",
]);

export const WEBKIT_ROUTER_EVENT_FIXTURE = Object.freeze({
  id: 13459,
  path: "/mobile/event/13459",
  title: "Lamako Acoustique #2 – Olombelo Ricky",
});

export type WebKitRouterScenarioSurface = "mobile-app" | "wordpress-control";

export type WebKitRouterEvidenceAttribution = {
  classification: WebKitNetworkClassification;
  releaseImpact:
    | "candidate-blocker"
    | "wordpress-control-debt"
    | "expected-navigation"
    | "none";
};

function classifySurface(
  observation: WebKitNetworkObservation,
): WebKitNetworkClassification["surface"] {
  let url: URL;
  try {
    url = new URL(observation.url);
  } catch {
    return "unknown";
  }
  const targetHost = observation.expectedHost ?? defaultTargetHost;
  if (url.hostname !== targetHost) return "third-party";
  if (url.pathname.startsWith("/mobile/")) return "app-static";
  if (
    url.pathname.startsWith("/wp-json/") ||
    url.pathname.startsWith("/lamako-catalog/")
  ) {
    return "api-target";
  }
  if (observation.resourceType === "image") return "image";
  return "target-other";
}

export function classifyWebKitNetworkObservation(
  observation: WebKitNetworkObservation,
): WebKitNetworkClassification {
  const surface = classifySurface(observation);
  const errorText = observation.errorText ?? "";
  const method = observation.method.toUpperCase();

  if (/cors|cross-origin|access control/i.test(errorText)) {
    return { surface, failureClass: "CORS", blocking: true };
  }
  if (/certificate|cert|ssl|tls/i.test(errorText)) {
    return { surface, failureClass: "TLS", blocking: true };
  }
  if (typeof observation.status === "number" && observation.status >= 400) {
    return { surface, failureClass: "HTTP", blocking: true };
  }
  if (/abort|cancel/i.test(errorText)) {
    const expectedReadOnlyCancellation =
      readOnlyMethods.has(method) &&
      observation.status === null &&
      observation.failureStep !== null &&
      expectedCancellationSteps.has(observation.failureStep);
    return {
      surface,
      failureClass: "navigation-abort",
      blocking: !expectedReadOnlyCancellation,
    };
  }
  if (errorText !== "") {
    return { surface, failureClass: "network", blocking: true };
  }
  return { surface, failureClass: "none", blocking: false };
}

/**
 * Separates failures owned by the mobile candidate from issues observed on
 * WordPress control pages. This does not relax the strict scenario gate: it
 * only prevents an unrelated baseline issue from being attributed to the
 * router or mobile bundle.
 */
export function attributeWebKitRouterEvidence(
  observation: WebKitNetworkObservation,
  scenarioSurface: WebKitRouterScenarioSurface,
): WebKitRouterEvidenceAttribution {
  const classification = classifyWebKitNetworkObservation(observation);
  const isMutation = !readOnlyMethods.has(observation.method.toUpperCase());

  if (isMutation || classification.blocking) {
    return {
      classification,
      releaseImpact:
        scenarioSurface === "mobile-app"
          ? "candidate-blocker"
          : "wordpress-control-debt",
    };
  }

  if (classification.failureClass === "navigation-abort") {
    return { classification, releaseImpact: "expected-navigation" };
  }

  return { classification, releaseImpact: "none" };
}

export type WebKitEventContractEvidence = {
  titlePresent: boolean;
  date27JunePresent: boolean;
  publicationDate3MayPresent: boolean;
  pass: boolean;
};

export function inspectWebKitEventContractText(
  text: string,
): WebKitEventContractEvidence {
  const titlePresent = text.includes(WEBKIT_ROUTER_EVENT_FIXTURE.title);
  const date27JunePresent = /(?:^|\D)27\s+juin(?:\s+2026)?(?:\D|$)/i.test(text);
  const publicationDate3MayPresent =
    /(?:^|\D)3\s+mai(?:\s+2026)?(?:\D|$)/i.test(text);
  return {
    titlePresent,
    date27JunePresent,
    publicationDate3MayPresent,
    pass: titlePresent && date27JunePresent && !publicationDate3MayPresent,
  };
}

export type WebKitScenarioMetrics = {
  stabilized: boolean;
  blockingNetworkFailures: number;
  httpErrors: number;
  mutations: number;
  hashRequests: number;
  consoleErrors: number;
  pageErrors: number;
  invalidApiResponses: number;
  horizontalOverflow: boolean;
  date27JunePresent: boolean;
  publicationDate3MayPresent: boolean;
  deepRefreshPass: boolean;
};

export function evaluateWebKitScenarioGate(metrics: WebKitScenarioMetrics): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!metrics.stabilized) reasons.push("scenario_not_stabilized");
  if (metrics.blockingNetworkFailures !== 0)
    reasons.push("blocking_network_failure");
  if (metrics.httpErrors !== 0) reasons.push("http_error");
  if (metrics.mutations !== 0) reasons.push("mutation");
  if (metrics.hashRequests !== 0) reasons.push("blurhash_request");
  if (metrics.consoleErrors !== 0) reasons.push("console_error");
  if (metrics.pageErrors !== 0) reasons.push("page_error");
  if (metrics.invalidApiResponses !== 0) reasons.push("invalid_api_response");
  if (metrics.horizontalOverflow) reasons.push("horizontal_overflow");
  if (!metrics.date27JunePresent) reasons.push("contract_date_missing");
  if (metrics.publicationDate3MayPresent)
    reasons.push("publication_date_rendered");
  if (!metrics.deepRefreshPass) reasons.push("deep_refresh_failed");
  return { pass: reasons.length === 0, reasons };
}

export async function runWithWebKitEvidence<T extends Record<string, unknown>>(
  reportPath: string,
  initialReport: T,
  run: (setReport: (report: T) => void) => Promise<void>,
): Promise<void> {
  let report: Record<string, unknown> = initialReport;
  try {
    await run((nextReport) => {
      report = nextReport;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report = { ...report, result: "FAIL", error: message };
    throw error;
  } finally {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
}

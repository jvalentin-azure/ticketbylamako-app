import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type WebKitNetworkObservation = {
  method: string;
  url: string;
  resourceType: string;
  status: number | null;
  errorText: string | null;
  failureStep: string | null;
};

export type WebKitNetworkClassification = {
  surface:
    | "app-static"
    | "api-staging"
    | "image"
    | "third-party"
    | "staging-other"
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

const stagingHost = "staging.ticketbylamako.com";
const readOnlyMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const expectedCancellationSteps = new Set(["initial-navigation", "deep-refresh"]);

function classifySurface(
  observation: WebKitNetworkObservation,
): WebKitNetworkClassification["surface"] {
  let url: URL;
  try {
    url = new URL(observation.url);
  } catch {
    return "unknown";
  }
  if (url.hostname !== stagingHost) return "third-party";
  if (url.pathname.startsWith("/mobile/")) return "app-static";
  if (url.pathname.startsWith("/wp-json/") || url.pathname.startsWith("/lamako-catalog/")) {
    return "api-staging";
  }
  if (observation.resourceType === "image") return "image";
  return "staging-other";
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
  if (metrics.blockingNetworkFailures !== 0) reasons.push("blocking_network_failure");
  if (metrics.httpErrors !== 0) reasons.push("http_error");
  if (metrics.mutations !== 0) reasons.push("mutation");
  if (metrics.hashRequests !== 0) reasons.push("blurhash_request");
  if (metrics.consoleErrors !== 0) reasons.push("console_error");
  if (metrics.pageErrors !== 0) reasons.push("page_error");
  if (metrics.invalidApiResponses !== 0) reasons.push("invalid_api_response");
  if (metrics.horizontalOverflow) reasons.push("horizontal_overflow");
  if (!metrics.date27JunePresent) reasons.push("contract_date_missing");
  if (metrics.publicationDate3MayPresent) reasons.push("publication_date_rendered");
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

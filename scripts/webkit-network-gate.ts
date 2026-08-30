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

/**
 * Content assertions run after the first-use flow. A fresh browser context
 * without this state renders the onboarding shell instead of mounting the
 * requested Expo route, so no event API request is expected yet.
 *
 * The first-use/onboarding journey remains a separate scenario and must not
 * use this seed.
 */
export const WEBKIT_ROUTER_ONBOARDING_FIXTURE = Object.freeze({
  storageKey: "@ticketbylamako/onboarding-version",
  version: "2",
  skipLabel: "Passer",
});

export type WebKitViewportImageEvidence = {
  elementPresent: boolean;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  visibleWidth: number;
  visibleHeight: number;
  intersectionRatio: number;
};

export type WebKitOnboardingSlideId = "1" | "2";

export type WebKitOnboardingSlideEvidence = {
  slideId: WebKitOnboardingSlideId;
  activeSlideIndex: number;
  renderedText: string;
  image: WebKitViewportImageEvidence;
};

const onboardingSlideContracts = Object.freeze({
  "1": Object.freeze({
    activeSlideIndex: 0,
    title: "Prenez place. Vivez grand.",
    action: "Suivant",
  }),
  "2": Object.freeze({
    activeSlideIndex: 1,
    title: "Votre prochain souvenir commence ici.",
    action: "Découvrir",
  }),
});

function normalizeRenderedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Gates an onboarding slide on what WebKit actually rendered in the viewport.
 * Asset filenames are intentionally not part of the contract: Expo may hash,
 * preload or satisfy an image from memory without issuing a request containing
 * the source filename. Network failures remain covered by the independent
 * network gate.
 */
export function evaluateWebKitOnboardingSlide(
  evidence: WebKitOnboardingSlideEvidence,
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const contract = (
    onboardingSlideContracts as Readonly<
      Record<
        string,
        { activeSlideIndex: number; title: string; action: string } | undefined
      >
    >
  )[evidence.slideId];
  if (!contract) {
    return { pass: false, reasons: ["slide_identity_unknown"] };
  }
  if (
    !Number.isInteger(evidence.activeSlideIndex) ||
    evidence.activeSlideIndex !== contract.activeSlideIndex
  ) {
    reasons.push("slide_identity_mismatch");
  }
  const renderedText = normalizeRenderedText(evidence.renderedText);
  if (!renderedText.includes(contract.title)) {
    reasons.push("slide_title_not_visible");
  }
  if (!renderedText.includes(contract.action)) {
    reasons.push("slide_action_not_visible");
  }
  if (evidence.image.elementPresent !== true)
    reasons.push("slide_image_missing");
  const imageNumbers = [
    evidence.image.naturalWidth,
    evidence.image.naturalHeight,
    evidence.image.visibleWidth,
    evidence.image.visibleHeight,
    evidence.image.intersectionRatio,
  ];
  const validImageNumbers = imageNumbers.every(Number.isFinite);
  if (
    evidence.image.elementPresent === true &&
    (!validImageNumbers ||
      evidence.image.complete !== true ||
      evidence.image.naturalWidth <= 0 ||
      evidence.image.naturalHeight <= 0)
  ) {
    reasons.push("slide_image_not_loaded");
  }
  if (
    evidence.image.elementPresent === true &&
    (!validImageNumbers ||
      evidence.image.visibleWidth <= 0 ||
      evidence.image.visibleHeight <= 0 ||
      evidence.image.intersectionRatio <= 0 ||
      evidence.image.intersectionRatio > 1)
  ) {
    reasons.push("slide_image_not_in_viewport");
  }
  return { pass: reasons.length === 0, reasons };
}

export type WebKitClassicControlEvidence = {
  controlId: "desktop-root" | "explicit-classic" | "payment-return";
  finalUrl: string;
  expectedOrigin: string;
  markerCount: number;
  mobileDocumentRequests: number;
  routerReplacementAttempts: number;
};

function decodePathFailClosed(pathname: string): string | null {
  let path = pathname.toLowerCase();
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const decoded = decodeURIComponent(path).toLowerCase();
      if (decoded === path) break;
      path = decoded;
    }
  } catch {
    return null;
  }
  return path.startsWith("/") ? path.replace(/\/{2,}/g, "/") : null;
}

/**
 * The router marker is cache-safe and may legitimately be present in desktop
 * HTML. A classic control passes when it does not navigate to the mobile app;
 * requiring markerCount=0 incorrectly fails the intended architecture.
 */
export function evaluateWebKitClassicControl(
  evidence: WebKitClassicControlEvidence,
): { pass: boolean; reasons: string[]; markerCount: number } {
  const reasons: string[] = [];
  if (
    !["desktop-root", "explicit-classic", "payment-return"].includes(
      evidence.controlId,
    )
  ) {
    reasons.push("classic_control_identity_unknown");
  }
  let finalUrl: URL | null = null;
  let expectedOrigin: URL | null = null;
  try {
    finalUrl = new URL(evidence.finalUrl);
    expectedOrigin = new URL(evidence.expectedOrigin);
  } catch {
    reasons.push("classic_control_url_invalid");
  }
  if (
    finalUrl &&
    expectedOrigin &&
    (finalUrl.origin !== expectedOrigin.origin ||
      !["http:", "https:"].includes(finalUrl.protocol))
  ) {
    reasons.push("classic_control_origin_mismatch");
  }
  if (finalUrl) {
    const finalPath = decodePathFailClosed(finalUrl.pathname);
    if (finalPath === null) {
      reasons.push("classic_control_path_invalid");
    } else if (finalPath === "/mobile" || finalPath.startsWith("/mobile/")) {
      reasons.push("classic_control_routed_to_mobile");
    } else if (
      evidence.controlId === "desktop-root" &&
      (finalPath !== "/" || finalUrl.search !== "")
    ) {
      reasons.push("desktop_root_contract_mismatch");
    } else if (
      evidence.controlId === "explicit-classic" &&
      (finalPath !== "/" || finalUrl.searchParams.get("desktop") !== "1")
    ) {
      reasons.push("explicit_classic_contract_mismatch");
    } else if (
      evidence.controlId === "payment-return" &&
      !["/paiement", "/cart", "/panier"].some(
        (prefix) => finalPath === prefix || finalPath.startsWith(`${prefix}/`),
      )
    ) {
      reasons.push("payment_return_contract_mismatch");
    }
  }
  const counters = [
    evidence.markerCount,
    evidence.mobileDocumentRequests,
    evidence.routerReplacementAttempts,
  ];
  if (!counters.every((value) => Number.isInteger(value) && value >= 0)) {
    reasons.push("classic_control_metrics_invalid");
  }
  const expectedMarkerCount = evidence.controlId === "payment-return" ? 0 : 1;
  if (evidence.markerCount !== expectedMarkerCount) {
    reasons.push("classic_control_marker_mismatch");
  }
  if (evidence.mobileDocumentRequests !== 0) {
    reasons.push("mobile_document_requested");
  }
  if (evidence.routerReplacementAttempts !== 0) {
    reasons.push("router_replacement_attempted");
  }
  return {
    pass: reasons.length === 0,
    reasons,
    markerCount: evidence.markerCount,
  };
}

export type WebKitWordPressControlDebt = {
  cafeAsset403: number;
  otherHttpErrors: number;
  consoleIssues: number;
  pageErrors: number;
  mutationAttempts: number;
  transmittedMutations: number;
};

/**
 * WordPress-control debt is attributed separately from the mobile candidate,
 * but it remains release-blocking. This function deliberately provides no
 * waiver for known cafe-events-carousel failures or deprecation noise.
 */
export function evaluateWebKitWordPressControlDebt(
  debt: WebKitWordPressControlDebt,
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (debt.cafeAsset403 !== 0) reasons.push("cafe_events_carousel_403");
  if (debt.otherHttpErrors !== 0) reasons.push("wordpress_http_error");
  if (debt.consoleIssues !== 0) reasons.push("wordpress_console_issue");
  if (debt.pageErrors !== 0) reasons.push("wordpress_page_error");
  if (debt.mutationAttempts !== 0) reasons.push("wordpress_mutation_attempt");
  if (debt.transmittedMutations !== 0)
    reasons.push("wordpress_mutation_transmitted");
  return { pass: reasons.length === 0, reasons };
}

export type WebKitContentBootstrapEvidence = {
  onboardingAssetRequests: number;
  eventApiRequests: number;
  eventContractReached: boolean;
};

export type WebKitContentBootstrapDiagnosis =
  | "ready"
  | "blocked-by-onboarding"
  | "api-not-started"
  | "event-contract-failure";

export function diagnoseWebKitContentBootstrap(
  evidence: WebKitContentBootstrapEvidence,
): WebKitContentBootstrapDiagnosis {
  if (evidence.onboardingAssetRequests > 0 && evidence.eventApiRequests === 0) {
    return "blocked-by-onboarding";
  }
  if (evidence.eventApiRequests === 0) return "api-not-started";
  if (evidence.eventContractReached) return "ready";
  return "event-contract-failure";
}

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
  if (metrics.stabilized !== true) reasons.push("scenario_not_stabilized");
  if (metrics.blockingNetworkFailures !== 0)
    reasons.push("blocking_network_failure");
  if (metrics.httpErrors !== 0) reasons.push("http_error");
  if (metrics.mutations !== 0) reasons.push("mutation");
  if (metrics.hashRequests !== 0) reasons.push("blurhash_request");
  if (metrics.consoleErrors !== 0) reasons.push("console_error");
  if (metrics.pageErrors !== 0) reasons.push("page_error");
  if (metrics.invalidApiResponses !== 0) reasons.push("invalid_api_response");
  if (metrics.horizontalOverflow !== false) reasons.push("horizontal_overflow");
  if (metrics.date27JunePresent !== true) reasons.push("contract_date_missing");
  if (metrics.publicationDate3MayPresent !== false)
    reasons.push("publication_date_rendered");
  if (metrics.deepRefreshPass !== true) reasons.push("deep_refresh_failed");
  return { pass: reasons.length === 0, reasons };
}

export type WebKitRouterReleaseEvidence = {
  contentScenario: WebKitScenarioMetrics;
  onboardingSlides: WebKitOnboardingSlideEvidence[];
  classicControls: WebKitClassicControlEvidence[];
  wordpressControl: WebKitWordPressControlDebt;
};

/**
 * Single fail-closed verdict consumed by the future WebKit runner. Keeping the
 * component gates separate is useful for diagnostics; composing them here
 * prevents a runner from accidentally qualifying only the content scenario.
 */
export function evaluateWebKitRouterReleaseGate(
  evidence: WebKitRouterReleaseEvidence,
): { pass: boolean; reasons: string[] } {
  const reasons = evaluateWebKitScenarioGate(
    evidence.contentScenario,
  ).reasons.map((reason) => `content:${reason}`);

  const onboardingSlides = Array.isArray(evidence.onboardingSlides)
    ? evidence.onboardingSlides
    : [];
  if (onboardingSlides.length !== 2) {
    reasons.push("onboarding:evidence_set_invalid");
  }
  if (
    onboardingSlides.some(
      (slide) => slide.slideId !== "1" && slide.slideId !== "2",
    )
  ) {
    reasons.push("onboarding:identity_unknown");
  }

  for (const slideId of ["1", "2"] as const) {
    const matchingSlides = onboardingSlides.filter(
      (slide) => slide.slideId === slideId,
    );
    if (matchingSlides.length !== 1) {
      reasons.push(`onboarding:${slideId}:evidence_count_invalid`);
      continue;
    }
    reasons.push(
      ...evaluateWebKitOnboardingSlide(matchingSlides[0]).reasons.map(
        (reason) => `onboarding:${slideId}:${reason}`,
      ),
    );
  }

  const classicControls = Array.isArray(evidence.classicControls)
    ? evidence.classicControls
    : [];
  if (classicControls.length !== 3) {
    reasons.push("classic:evidence_set_invalid");
  }
  if (
    classicControls.some(
      (control) =>
        control.controlId !== "desktop-root" &&
        control.controlId !== "explicit-classic" &&
        control.controlId !== "payment-return",
    )
  ) {
    reasons.push("classic:identity_unknown");
  }

  for (const controlId of [
    "desktop-root",
    "explicit-classic",
    "payment-return",
  ] as const) {
    const matchingControls = classicControls.filter(
      (control) => control.controlId === controlId,
    );
    if (matchingControls.length !== 1) {
      reasons.push(`classic:${controlId}:evidence_count_invalid`);
      continue;
    }
    reasons.push(
      ...evaluateWebKitClassicControl(matchingControls[0]).reasons.map(
        (reason) => `classic:${controlId}:${reason}`,
      ),
    );
  }

  reasons.push(
    ...evaluateWebKitWordPressControlDebt(
      evidence.wordpressControl,
    ).reasons.map((reason) => `wordpress:${reason}`),
  );

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

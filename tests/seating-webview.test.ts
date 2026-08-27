import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  buildSeatingInjectedJavaScript,
  isSeatingCheckoutUrl,
  isSeatingSessionUrl,
  isSeatingSuccessUrl,
  parseSeatingWebMessage,
} from "@/lib/seating-webview";

describe("seating WebView protocol", () => {
  it("accepts Lamako messages for the active flow", () => {
    const message = parseSeatingWebMessage(
      JSON.stringify({
        source: "lamako-mobile-web",
        version: 1,
        flowId: "flow-123",
        type: "SEAT_SELECTION_CHANGED",
        payload: { count: 2 },
      }),
      "flow-123",
    );

    expect(message?.type).toBe("SEAT_SELECTION_CHANGED");
    expect(message?.payload?.count).toBe(2);
  });

  it("rejects malformed, foreign and stale-flow messages", () => {
    expect(parseSeatingWebMessage("not-json", "flow-123")).toBeNull();
    expect(
      parseSeatingWebMessage(
        JSON.stringify({ source: "foreign", type: "FLOW_READY" }),
        "flow-123",
      ),
    ).toBeNull();
    expect(
      parseSeatingWebMessage(
        JSON.stringify({ type: "FLOW_READY", flowId: "flow-123" }),
        "flow-123",
      ),
    ).toBeNull();
    expect(
      parseSeatingWebMessage(
        JSON.stringify({
          source: "lamako-mobile-web",
          version: 1,
          type: "FLOW_READY",
        }),
        "flow-123",
      ),
    ).toBeNull();
    expect(
      parseSeatingWebMessage(
        JSON.stringify({
          source: "lamako-mobile-web",
          flowId: "stale-flow",
          type: "FLOW_READY",
        }),
        "flow-123",
      ),
    ).toBeNull();
  });

  it("classifies checkout, success and session URLs", () => {
    expect(isSeatingCheckoutUrl("https://example.com/checkout/")).toBe(true);
    expect(isSeatingCheckoutUrl("https://example.com/order-pay/123")).toBe(true);
    expect(isSeatingSuccessUrl("https://example.com/order-received/123")).toBe(true);
    expect(isSeatingSessionUrl("https://example.com/lamako-mobile/seat/token/")).toBe(true);
    expect(isSeatingSessionUrl("https://example.com/events/123")).toBe(false);
  });

  it("scopes injected messages to the active flow", () => {
    const script = buildSeatingInjectedJavaScript("flow-123");
    expect(script).toContain("flowId: 'flow-123'");
    expect(script).toContain("window.ReactNativeWebView.postMessage");
  });

  it("keeps the embedded Tickera controls interactive without public cart drawers", () => {
    const commerce = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "scripts",
        "lamako-mobile-api",
        "includes",
        "v2-commerce.php",
      ),
      "utf8",
    );
    expect(commerce).toContain('content="width=device-width, initial-scale=1, viewport-fit=cover"');
    expect(commerce).toContain(".tc-seat-dialog.ui-dialog * { pointer-events: auto");
    expect(commerce).toContain("'tbl-event-fast-checkout', 'fkcart-script'");
    expect(commerce).toContain("releaseEmbeddedConsentWall");
    expect(commerce).not.toContain('content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"');
  });

  it("uses the stable POS WebView contract and verifies the server order", () => {
    const flow = fs.readFileSync(
      path.resolve(
        __dirname,
        "..",
        "components",
        "seating",
        "SeatPurchaseFlow.tsx",
      ),
      "utf8",
    );

    expect(flow).toContain("incognito");
    expect(flow).toContain("thirdPartyCookiesEnabled");
    expect(flow).not.toContain("sharedCookiesEnabled");
    expect(flow).not.toContain("injectedJavaScript={");
    expect(flow.match(/refreshSeatingOrder\(8, 600\)/g)).toHaveLength(2);
    expect(flow).toContain("getMobileSeatingSessionStatus");
    expect(flow).toContain("cancelMobileSeatingSession(flowToken)");
    expect(flow).toContain("void releaseAndClose()");
  });
});

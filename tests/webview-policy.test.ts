import { afterEach, describe, expect, it } from "vitest";
import { isAllowedWebViewUrl } from "../lib/webview-policy";

const originalPaymentHosts = process.env.EXPO_PUBLIC_PAYMENT_HOSTS;

afterEach(() => {
  process.env.EXPO_PUBLIC_PAYMENT_HOSTS = originalPaymentHosts;
});

describe("WebView navigation policy", () => {
  it("allows first-party HTTPS navigation", () => {
    expect(
      isAllowedWebViewUrl(
        "https://www.ticketbylamako.com/checkout/order-pay/42",
        "first-party",
      ),
    ).toBe(true);
    expect(
      isAllowedWebViewUrl(
        "https://ticketbylamako.com/lamako-mobile/payment-return",
        "payment",
      ),
    ).toBe(true);
  });

  it("does not trust arbitrary first-party subdomains", () => {
    expect(
      isAllowedWebViewUrl(
        "https://untrusted.ticketbylamako.com/checkout",
        "first-party",
      ),
    ).toBe(false);
  });

  it("blocks unknown and insecure navigation", () => {
    expect(isAllowedWebViewUrl("https://example.org/phishing", "payment")).toBe(
      false,
    );
    expect(
      isAllowedWebViewUrl("http://www.ticketbylamako.com/checkout", "payment"),
    ).toBe(false);
    expect(isAllowedWebViewUrl("javascript:alert(1)", "payment")).toBe(false);
  });

  it("allows audited payment providers only during payment", () => {
    const url = "https://secureacceptance.cybersource.com/pay";
    expect(isAllowedWebViewUrl(url, "first-party")).toBe(false);
    expect(isAllowedWebViewUrl(url, "payment")).toBe(true);
  });

  it("supports additional public payment hosts from build configuration", () => {
    process.env.EXPO_PUBLIC_PAYMENT_HOSTS = "pay.example.mg";
    expect(
      isAllowedWebViewUrl("https://secure.pay.example.mg/authorize", "payment"),
    ).toBe(true);
  });
});

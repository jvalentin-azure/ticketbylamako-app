import { afterEach, describe, expect, it } from "vitest";
import { isAllowedWebViewUrl } from "../lib/webview-policy";

const originalPaymentHosts = process.env.EXPO_PUBLIC_PAYMENT_HOSTS;
const configuredSiteUrl =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const configuredSiteHost = new URL(configuredSiteUrl).hostname;

afterEach(() => {
  process.env.EXPO_PUBLIC_PAYMENT_HOSTS = originalPaymentHosts;
});

describe("WebView navigation policy", () => {
  it("allows first-party HTTPS navigation", () => {
    expect(
      isAllowedWebViewUrl(
        new URL("/checkout/order-pay/42", configuredSiteUrl).toString(),
        "first-party",
      ),
    ).toBe(true);
    expect(
      isAllowedWebViewUrl(
        new URL("/lamako-mobile/payment-return", configuredSiteUrl).toString(),
        "payment",
      ),
    ).toBe(true);
  });

  it("does not trust arbitrary first-party subdomains", () => {
    expect(
      isAllowedWebViewUrl(
        `https://untrusted.${configuredSiteHost}/checkout`,
        "first-party",
      ),
    ).toBe(false);
  });

  it("blocks unknown and insecure navigation", () => {
    expect(isAllowedWebViewUrl("https://example.org/phishing", "payment")).toBe(
      false,
    );
    expect(
      isAllowedWebViewUrl(`http://${configuredSiteHost}/checkout`, "payment"),
    ).toBe(false);
    expect(isAllowedWebViewUrl("javascript:alert(1)", "payment")).toBe(false);
  });

  it("allows audited payment providers only during payment", () => {
    const url = "https://secureacceptance.cybersource.com/pay";
    expect(isAllowedWebViewUrl(url, "first-party")).toBe(false);
    expect(isAllowedWebViewUrl(url, "payment")).toBe(true);

    const orangeUrl = "https://webpayment.orange.mg/authorize";
    expect(isAllowedWebViewUrl(orangeUrl, "first-party")).toBe(false);
    expect(isAllowedWebViewUrl(orangeUrl, "payment")).toBe(true);

    const orangeProviderUrl =
      "https://webpayment-qualif.orange-money.com/payment/pay_token";
    expect(isAllowedWebViewUrl(orangeProviderUrl, "first-party")).toBe(false);
    expect(isAllowedWebViewUrl(orangeProviderUrl, "payment")).toBe(true);
    expect(
      isAllowedWebViewUrl(
        "https://orange-money.com.example.org/payment/pay_token",
        "payment",
      ),
    ).toBe(false);
  });

  it("supports additional public payment hosts from build configuration", () => {
    process.env.EXPO_PUBLIC_PAYMENT_HOSTS = "pay.example.mg";
    expect(
      isAllowedWebViewUrl("https://secure.pay.example.mg/authorize", "payment"),
    ).toBe(true);
  });
});

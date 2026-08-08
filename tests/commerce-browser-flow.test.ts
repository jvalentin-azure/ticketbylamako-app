import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("native commerce browser flow", () => {
  it("opens checkout and seating in the secure system browser", () => {
    expect(source("app/checkout.tsx")).toContain(
      "openCommerceSession(checkoutUrl)",
    );
    expect(source("components/seating/SeatPurchaseFlow.tsx")).toContain(
      "openCommerceSession(session.seatUrl)",
    );
  });

  it("keeps server-side status verification after the browser returns", () => {
    expect(source("app/checkout.tsx")).toContain(
      "getMobileCheckoutStatus(checkoutToken)",
    );
    expect(source("components/seating/SeatPurchaseFlow.tsx")).toContain(
      "getMobileSeatingSessionStatus(session.flowToken)",
    );
  });

  it("restricts the initial commerce URL to the configured first-party host", () => {
    const browserSource = source("lib/commerce-browser.ts");
    expect(browserSource).toContain(
      'isAllowedWebViewUrl(url, "first-party")',
    );
    expect(browserSource).toContain("openAuthSessionAsync");
  });
});

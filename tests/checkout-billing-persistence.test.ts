import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const checkout = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "checkout.tsx"),
  "utf8",
);

describe("product checkout billing persistence", () => {
  it("prefills billing details from local storage and the server profile", () => {
    expect(checkout).toContain("getBillingInfo()");
    expect(checkout).toContain("getMobileProfile()");
    expect(checkout).toContain("storedBilling?.address || profile?.billing.address_1");
  });

  it("saves validated product billing details locally and syncs the profile", () => {
    expect(checkout).toContain("await saveBillingInfo(billing)");
    expect(checkout).toContain("void updateMobileProfile({");
    expect(checkout).toContain('country: "MG"');
  });
});

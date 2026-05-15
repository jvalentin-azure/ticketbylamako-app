import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("mobile v2 commerce client", () => {
  it("does not depend on WooCommerce consumer credentials", () => {
    const mobileClient = fs.readFileSync(
      path.join(process.cwd(), "lib", "api", "mobile.ts"),
      "utf-8"
    );

    expect(mobileClient).toContain("lamako-mobile/v2");
    expect(mobileClient).toContain("Authorization");
    expect(mobileClient).not.toContain("EXPO_PUBLIC_WC_CONSUMER_KEY");
    expect(mobileClient).not.toContain("EXPO_PUBLIC_WC_CONSUMER_SECRET");
  });

  it("keeps the deprecated WooCommerce facade credential-free", () => {
    const facade = fs.readFileSync(
      path.join(process.cwd(), "lib", "api", "woocommerce.ts"),
      "utf-8"
    );

    expect(facade).not.toContain("wc/v3");
    expect(facade).not.toContain("consumer_key");
    expect(facade).not.toContain("consumer_secret");
    expect(facade).not.toContain("EXPO_PUBLIC_WC_CONSUMER_KEY");
    expect(facade).not.toContain("EXPO_PUBLIC_WC_CONSUMER_SECRET");
  });
});

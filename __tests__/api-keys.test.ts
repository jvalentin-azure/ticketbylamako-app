import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("client secret policy", () => {
  it("documents WooCommerce, JWT, and rewards secrets as deprecated client variables", () => {
    const envExample = fs.readFileSync(path.join(process.cwd(), "ENV_EXAMPLE.md"), "utf-8");

    expect(envExample).toContain("Deprecated client variables");
    expect(envExample).toContain("EXPO_PUBLIC_WC_CONSUMER_SECRET");
    expect(envExample).toContain("EXPO_PUBLIC_JWT_SECRET");
    expect(envExample).toContain("EXPO_PUBLIC_REWARDS_API_KEY");
    expect(envExample).toContain("must not be present in production mobile builds");
  });

  it("does not keep the legacy rewards API key hardcoded in the app source", () => {
    const rewardsProvider = fs.readFileSync(
      path.join(process.cwd(), "lib", "rewards-provider.tsx"),
      "utf-8"
    );

    expect(rewardsProvider).not.toContain("LR_2024_SECURE_KEY_TBL");
  });

  it("uses the JWT-authenticated v2 checkout client for native checkout", () => {
    const checkout = fs.readFileSync(path.join(process.cwd(), "app", "checkout.tsx"), "utf-8");

    expect(checkout).toContain("createMobileCheckout");
    expect(checkout).toContain("getMobileCheckoutStatus");
    expect(checkout).not.toContain("MOBILE_V2_COMMERCE_ENABLED");
    expect(checkout).not.toContain("createOrder");
    expect(checkout).not.toContain("orderKey");
    expect(checkout).not.toContain("checkout_url");
    expect(checkout).not.toContain("clearServerCart");
  });

  it("keeps native cart clearing local-only", () => {
    const cartProvider = fs.readFileSync(
      path.join(process.cwd(), "lib", "cart-provider.tsx"),
      "utf-8"
    );

    expect(cartProvider).not.toContain("clearServerCart");
  });

  it("uses tokenized v2 seating sessions instead of JWT auto-login by default", () => {
    const eventScreen = fs.readFileSync(
      path.join(process.cwd(), "app", "event", "[id].tsx"),
      "utf-8"
    );
    const seatingComponent = fs.readFileSync(
      path.join(process.cwd(), "components", "seating", "SeatPurchaseFlow.tsx"),
      "utf-8"
    );
    const mobileClient = fs.readFileSync(
      path.join(process.cwd(), "lib", "api", "mobile.ts"),
      "utf-8"
    );

    expect(eventScreen).toContain("MOBILE_V2_SEATING_ENABLED");
    expect(eventScreen).toContain("SeatPurchaseFlow");
    expect(seatingComponent).toContain("createMobileSeatingSession");
    expect(seatingComponent).toContain("getMobileSeatingSessionStatus");
    expect(mobileClient).toContain("seating-sessions");
  });

  it("uses a stable payment return deep link and verifies returns server-side", () => {
    const appConfig = fs.readFileSync(path.join(process.cwd(), "app.config.ts"), "utf-8");
    const paymentReturn = fs.readFileSync(
      path.join(process.cwd(), "app", "payment-return.tsx"),
      "utf-8"
    );
    const helper = fs.readFileSync(path.join(process.cwd(), "lib", "payment-return.ts"), "utf-8");

    expect(appConfig).toContain('scheme: "ticketbylamako"');
    expect(appConfig).toContain('host: "payment-return"');
    expect(paymentReturn).toContain("verifyPaymentReturn");
    expect(helper).toContain("getMobilePaymentReturnStatus");
  });

  it("adds v2 payment return pages without exposing WooCommerce order keys in deep links", () => {
    const plugin = fs.readFileSync(
      path.join(process.cwd(), "scripts", "lamako-mobile-api", "includes", "v2-commerce.php"),
      "utf-8"
    );

    expect(plugin).toContain("/lamako-mobile/(payment-return|payment-failed|payment-cancel)");
    expect(plugin).toContain("ticketbylamako://payment-return?kind=");
    expect(plugin).toContain("lamako_mobile_checkout_token");
    expect(plugin).toContain("payment-return/(?P<token>");
    expect(plugin).toContain("woocommerce_get_return_url");
    expect(plugin).not.toContain("ticketbylamako://payment-return?order_key=");
  });

  it("routes checkout and seating WebView payment returns through the verified native return screen", () => {
    const checkout = fs.readFileSync(path.join(process.cwd(), "app", "checkout.tsx"), "utf-8");
    const seatingComponent = fs.readFileSync(
      path.join(process.cwd(), "components", "seating", "SeatPurchaseFlow.tsx"),
      "utf-8"
    );

    expect(checkout).toContain("parsePaymentReturnUrl");
    expect(checkout).toContain('pathname: "/payment-return"');
    expect(seatingComponent).toContain("parsePaymentReturnUrl");
    expect(seatingComponent).toContain('pathname: "/payment-return"');
  });

  it("uses v2 authenticated APIs for customer orders, tickets, rewards, referrals, and push tokens", () => {
    const orders = fs.readFileSync(path.join(process.cwd(), "app", "orders.tsx"), "utf-8");
    const orderDetail = fs.readFileSync(
      path.join(process.cwd(), "app", "order", "[id].tsx"),
      "utf-8"
    );
    const ticketDetail = fs.readFileSync(
      path.join(process.cwd(), "app", "ticket", "[id].tsx"),
      "utf-8"
    );
    const ticketsTab = fs.readFileSync(
      path.join(process.cwd(), "app", "(tabs)", "tickets.tsx"),
      "utf-8"
    );
    const rewardsProvider = fs.readFileSync(
      path.join(process.cwd(), "lib", "rewards-provider.tsx"),
      "utf-8"
    );
    const notifications = fs.readFileSync(
      path.join(process.cwd(), "lib", "notifications.ts"),
      "utf-8"
    );

    expect(orders).toContain("getMobileOrders");
    expect(orderDetail).toContain("getMobileOrder");
    expect(orderDetail).toContain("getMobileOrderTickets");
    expect(ticketDetail).toContain("getMobileOrder");
    expect(ticketsTab).toContain("getMobileOrderTickets");
    expect(rewardsProvider).toContain("getMobileRewardsBalance");
    expect(rewardsProvider).toContain("redeemMobileRewards");
    expect(rewardsProvider).toContain("validateMobileReferralCode");
    expect(rewardsProvider).not.toContain("EXPO_PUBLIC_REWARDS_API_KEY");
    expect(rewardsProvider).not.toContain("lamako-rewards/v1");
    expect(rewardsProvider).not.toContain("api_key");
    expect(notifications).toContain("registerMobilePushToken");
  });

  it("exposes v2 referral and enriched order/ticket fields server-side", () => {
    const plugin = fs.readFileSync(
      path.join(process.cwd(), "scripts", "lamako-mobile-api", "includes", "v2-commerce.php"),
      "utf-8"
    );

    expect(plugin).toContain("/referral/validate");
    expect(plugin).toContain("/referral/register");
    expect(plugin).toContain("lamako_mobile_v2_validate_referral_code");
    expect(plugin).toContain("lamako_mobile_v2_register_referral");
    expect(plugin).toContain("'eventDate'");
    expect(plugin).toContain("'price'");
  });

  it("adds EAS build profiles and blocks deprecated public secrets before mobile builds", () => {
    const eas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "eas.json"), "utf-8"));
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
    const secretCheck = fs.readFileSync(
      path.join(process.cwd(), "scripts", "check-mobile-secrets.mjs"),
      "utf-8"
    );
    const phase6 = fs.readFileSync(
      path.join(process.cwd(), "docs", "phase-6-mobile-qa.md"),
      "utf-8"
    );

    expect(eas.build.development.env).not.toHaveProperty("EXPO_PUBLIC_ENABLE_MOBILE_V2_COMMERCE");
    expect(eas.build.preview.env.EXPO_PUBLIC_ENABLE_MOBILE_V2_SEATING).toBe("true");
    expect(eas.build.production.env.EXPO_PUBLIC_SITE_URL).toBe("https://www.ticketbylamako.com");
    expect(pkg.scripts["check:mobile-secrets"]).toBe("node scripts/check-mobile-secrets.mjs");
    expect(pkg.scripts["eas-build-pre-install"]).toBe("node scripts/check-mobile-secrets.mjs");
    expect(secretCheck).toContain("EXPO_PUBLIC_WC_CONSUMER_SECRET");
    expect(secretCheck).toContain("EXPO_PUBLIC_JWT_SECRET");
    expect(secretCheck).toContain("EXPO_PUBLIC_REWARDS_API_KEY");
    expect(phase6).toContain("Manual QA Matrix");
    expect(phase6).toContain("Cold start the app");
  });

  it("uses v2 public read endpoints for native browsing without WooCommerce client secrets", () => {
    const catalogClient = fs.readFileSync(
      path.join(process.cwd(), "lib", "api", "catalog.ts"),
      "utf-8"
    );
    const browseScreens = [
      path.join(process.cwd(), "app", "(tabs)", "index.tsx"),
      path.join(process.cwd(), "app", "(tabs)", "events.tsx"),
      path.join(process.cwd(), "app", "(tabs)", "shop.tsx"),
      path.join(process.cwd(), "app", "event", "[id].tsx"),
      path.join(process.cwd(), "app", "product", "[id].tsx"),
      path.join(process.cwd(), "app", "search.tsx"),
    ].map(file => fs.readFileSync(file, "utf-8"));
    const plugin = fs.readFileSync(
      path.join(process.cwd(), "scripts", "lamako-mobile-api", "includes", "v2-commerce.php"),
      "utf-8"
    );

    expect(plugin).toContain("/public/home-data");
    expect(plugin).toContain("/public/events-data");
    expect(plugin).toContain("/public/shop-data");
    expect(plugin).toContain("/public/products/(?P<product_id>\\d+)");
    expect(plugin).toContain("lamako_mobile_v2_public_home_data");
    expect(plugin).toContain("lamako_mobile_v2_public_product");
    expect(catalogClient).toContain("Native catalog data facade");
    expect(catalogClient).toContain("public/home-data");
    expect(catalogClient).toContain("public/events-data");
    expect(catalogClient).toContain("public/shop-data");
    expect(catalogClient).toContain("public/products/");
    expect(catalogClient).not.toContain("./woocommerce");
    expect(catalogClient).not.toContain("consumer_secret");
    for (const screen of browseScreens) {
      expect(screen).toContain("@/lib/api/catalog");
      expect(screen).not.toContain("@/lib/api/woocommerce");
    }
  });

  it("keeps shared commerce types outside the legacy WooCommerce client", () => {
    const commerceTypes = fs.readFileSync(
      path.join(process.cwd(), "lib", "types", "commerce.ts"),
      "utf-8"
    );
    const catalogClient = fs.readFileSync(
      path.join(process.cwd(), "lib", "api", "catalog.ts"),
      "utf-8"
    );
    const orderSurfaces = [
      path.join(process.cwd(), "app", "orders.tsx"),
      path.join(process.cwd(), "app", "order", "[id].tsx"),
      path.join(process.cwd(), "app", "ticket", "[id].tsx"),
      path.join(process.cwd(), "lib", "order-adapters.ts"),
    ].map(file => fs.readFileSync(file, "utf-8"));

    expect(commerceTypes).toContain("export interface WCProduct");
    expect(commerceTypes).toContain("export interface WCOrder");
    expect(commerceTypes).toContain("export interface TicketInstance");
    expect(catalogClient).toContain("@/lib/types/commerce");
    for (const surface of orderSurfaces) {
      expect(surface).toContain("@/lib/types/commerce");
      expect(surface).not.toContain("@/lib/api/woocommerce");
    }
  });
});

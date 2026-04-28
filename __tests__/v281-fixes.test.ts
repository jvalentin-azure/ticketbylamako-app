import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("V2.8.1 - Seating Chart Fix", () => {
  it("seat extraction JS should ONLY use .tc_seat_in_cart selector", () => {
    const eventScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/event/[id].tsx"),
      "utf-8"
    );
    
    // The confirm button JS should use .tc_seat_in_cart
    expect(eventScreen).toContain("querySelectorAll('.tc_seat_in_cart')");
    
    // Should NOT contain the broad selector that matches ALL seats
    expect(eventScreen).not.toContain(".tc_set_seat[data-tt-id]");
    
    // Should NOT contain other broad selectors
    expect(eventScreen).not.toContain('.tc_seat[style*="opacity: 0.5"]');
  });

  it("seating embed CSS should NOT hide .tc_in_cart elements", () => {
    const plugin = fs.readFileSync(
      path.resolve(__dirname, "../scripts/lamako-mobile-api.php"),
      "utf-8"
    );
    
    // The CSS should not hide tc_in_cart (Tickera needs it visible for tracking)
    const cssHidePattern = /\.tc_in_cart\s*\{[^}]*display:\s*none/;
    expect(cssHidePattern.test(plugin)).toBe(false);
  });
});

describe("V2.8.1 - Checkout Fix (pay-for-order without login)", () => {
  it("WordPress plugin should have user_has_cap filter for pay_for_order", () => {
    const plugin = fs.readFileSync(
      path.resolve(__dirname, "../scripts/lamako-mobile-api.php"),
      "utf-8"
    );
    
    // Must have the user_has_cap filter
    expect(plugin).toContain("add_filter( 'user_has_cap'");
    expect(plugin).toContain("pay_for_order");
    
    // Must verify order key for security
    expect(plugin).toContain("get_order_key()");
    expect(plugin).toContain("$_GET['key']");
  });

  it("WordPress plugin should disable email verification for order-pay", () => {
    const plugin = fs.readFileSync(
      path.resolve(__dirname, "../scripts/lamako-mobile-api.php"),
      "utf-8"
    );
    
    expect(plugin).toContain("woocommerce_order_email_verification_required");
    expect(plugin).toContain("__return_false");
  });

  it("create-order should build pay URL manually (no WP nonce dependency)", () => {
    const plugin = fs.readFileSync(
      path.resolve(__dirname, "../scripts/lamako-mobile-api.php"),
      "utf-8"
    );
    
    // Should construct URL manually
    expect(plugin).toContain("home_url( '/checkout/order-pay/'");
    expect(plugin).toContain("pay_for_order=true&key=");
    
    // Should NOT use get_checkout_payment_url() which adds WP nonces
    expect(plugin).not.toContain("get_checkout_payment_url()");
  });

  it("checkout WebView should use .default import for react-native-webview", () => {
    const checkout = fs.readFileSync(
      path.resolve(__dirname, "../app/checkout.tsx"),
      "utf-8"
    );
    
    // Must use .default (not .WebView)
    expect(checkout).toContain('require("react-native-webview").default');
    expect(checkout).not.toContain('require("react-native-webview").WebView');
  });

  it("checkout WebView should detect order-received for success", () => {
    const checkout = fs.readFileSync(
      path.resolve(__dirname, "../app/checkout.tsx"),
      "utf-8"
    );
    
    expect(checkout).toContain("order-received");
    expect(checkout).toContain("clearCart");
  });
});

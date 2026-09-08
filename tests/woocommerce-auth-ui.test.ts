import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const source = readFileSync(
  resolve(root, "scripts/lamako-mobile-api/includes/woocommerce-auth-ui.php"),
  "utf8",
);

describe("WooCommerce unified customer authentication", () => {
  it("enables native email registration on My Account only", () => {
    expect(source).toContain(
      "option_woocommerce_enable_myaccount_registration",
    );
    expect(source).toContain(
      "option_woocommerce_registration_generate_password",
    );
    expect(source).toContain("woocommerce_registration_errors");
    expect(source).toContain("lamako_mobile_password_is_strong( $password )");
    expect(source).toContain("is_account_page()");
    expect(source).toContain("return 'yes'");
  });

  it("offers Apple, Google and Facebook on login and registration", () => {
    expect(source).toContain("woocommerce_login_form_start");
    expect(source).toContain("woocommerce_register_form_start");
    expect(source).toContain("lamako_apple_start");
    expect(source).toContain("/mobile/login");
    expect(source).toContain("lamako_facebook_start");
  });

  it("returns Google users to the classic account page after the shared handoff", () => {
    const login = readFileSync(resolve(root, "app/(auth)/login.tsx"), "utf8");
    expect(login).toContain("window.location.assign(returnTo)");
    expect(login).toContain('!returnTo.startsWith("//")');
  });

  it("escapes every provider URL before rendering", () => {
    expect(source.match(/esc_url\(/g)).toHaveLength(3);
  });
});

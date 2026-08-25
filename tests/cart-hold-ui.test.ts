import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cartScreen = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "(tabs)", "cart.tsx"),
  "utf8",
);
const cartProvider = fs.readFileSync(
  path.resolve(__dirname, "..", "lib", "cart-provider.tsx"),
  "utf8",
);
const appHeader = fs.readFileSync(
  path.resolve(__dirname, "..", "components", "app-header.tsx"),
  "utf8",
);
const checkoutSteps = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "components",
    "commerce",
    "CheckoutSteps.tsx",
  ),
  "utf8",
);
const rootLayout = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "_layout.tsx"),
  "utf8",
);

describe("cart hold experience", () => {
  it("shows the persisted countdown directly in the cart", () => {
    expect(cartScreen).toContain("<CartHoldCountdown expiresAt={expiresAt} />");
    expect(cartProvider).toContain(
      'const CART_EXPIRY_KEY = "cart_expires_at_v2"',
    );
  });

  it("does not extend the hold for quantity or navigation changes", () => {
    expect(cartProvider).toContain(
      "Quantity changes do not extend the original hold.",
    );
    expect(cartProvider).toContain(
      "The hold is absolute: backgrounding the app never extends it.",
    );
  });

  it("persists a checkout key and rotates it whenever cart content changes", () => {
    expect(cartProvider).toContain(
      'const CART_CHECKOUT_REQUEST_KEY = "cart_checkout_request_key_v1"',
    );
    expect(cartProvider).toContain("ensureCheckoutRequestKey");
    expect(cartProvider).toContain("rotateCheckoutRequestKey");
    expect(cartProvider).toContain("randomUUID()");
    expect(cartProvider).toContain(
      "AsyncStorage.removeItem(CART_CHECKOUT_REQUEST_KEY)",
    );
  });

  it("keeps a compact reservation reminder available across app routes", () => {
    expect(rootLayout).not.toContain("<GlobalCartHoldBanner />");
    expect(appHeader).toContain("usesOwnReservationTimer");
    expect(appHeader).toContain('["/cart", "/checkout", "/payment"]');
    expect(appHeader).toContain("remaining <= 2 * 60 * 1000");
    expect(appHeader).toContain('router.push("/(tabs)/cart"');
    expect(appHeader).toContain("styles.holdBar");
    expect(appHeader).toContain('alignSelf: "center"');
    expect(checkoutSteps).toContain(
      "<CartHoldCountdown expiresAt={expiresAt ?? null} />",
    );
  });
});

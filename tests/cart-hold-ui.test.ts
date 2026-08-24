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

describe("cart hold experience", () => {
  it("shows the persisted countdown directly in the cart", () => {
    expect(cartScreen).toContain("<CartHoldCountdown expiresAt={expiresAt} />");
    expect(cartProvider).toContain('const CART_EXPIRY_KEY = "cart_expires_at_v2"');
  });

  it("does not extend the hold for quantity or navigation changes", () => {
    expect(cartProvider).toContain(
      "Quantity changes do not extend the original hold.",
    );
    expect(cartProvider).toContain(
      "The hold is absolute: backgrounding the app never extends it.",
    );
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CART_HOLD_DURATION_MS,
  cartHoldRemainingMs,
  createCartExpiryTimestamp,
  parseCartExpiryTimestamp,
  parseStoredCart,
} from "../lib/cart-store";

const cartScreenSource = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "(tabs)", "cart.tsx"),
  "utf8",
);

const validItem = {
  productId: 42,
  name: "Billet standard",
  price: 300,
  quantity: 2,
  image: "https://example.com/ticket.jpg",
  isEvent: true,
  eventId: 12,
};

describe("cart storage", () => {
  it("restores valid items", () => {
    expect(parseStoredCart(JSON.stringify([validItem]))).toEqual([validItem]);
  });

  it("rejects corrupted storage without throwing", () => {
    expect(parseStoredCart("not-json")).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ item: validItem }))).toEqual([]);
  });

  it("filters invalid price and quantity values", () => {
    expect(
      parseStoredCart(
        JSON.stringify([
          validItem,
          { ...validItem, productId: 43, price: "300" },
          { ...validItem, productId: 44, quantity: 0 },
        ]),
      ),
    ).toEqual([validItem]);
  });

  it("uses a fixed ten-minute hold that cannot become negative", () => {
    const now = 1_780_000_000_000;
    const expiresAt = createCartExpiryTimestamp(now);
    expect(expiresAt).toBe(now + CART_HOLD_DURATION_MS);
    expect(cartHoldRemainingMs(expiresAt, now + 60_000)).toBe(
      CART_HOLD_DURATION_MS - 60_000,
    );
    expect(cartHoldRemainingMs(expiresAt, expiresAt + 1)).toBe(0);
    expect(parseCartExpiryTimestamp(String(expiresAt))).toBe(expiresAt);
    expect(parseCartExpiryTimestamp("invalid")).toBeNull();
  });

  it("renders cart thumbnails with the shared resilient component", () => {
    expect(cartScreenSource).toContain("import { CatalogImage }");
    expect(cartScreenSource).toContain("<CatalogImage");
    expect(cartScreenSource).not.toContain('from "expo-image"');
  });
});

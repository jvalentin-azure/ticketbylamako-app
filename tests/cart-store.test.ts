import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCartActivityTimestamp, parseStoredCart } from "../lib/cart-store";

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

  it("accepts only finite positive activity timestamps", () => {
    expect(parseCartActivityTimestamp("1780000000000")).toBe(1780000000000);
    expect(parseCartActivityTimestamp("invalid")).toBeNull();
    expect(parseCartActivityTimestamp("-1")).toBeNull();
  });

  it("renders cart thumbnails with the shared resilient component", () => {
    expect(cartScreenSource).toContain('import { CatalogImage }');
    expect(cartScreenSource).toContain("<CatalogImage");
    expect(cartScreenSource).not.toContain('from "expo-image"');
  });
});

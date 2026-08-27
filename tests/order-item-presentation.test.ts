import { describe, expect, it } from "vitest";

import {
  isTicketOrderItem,
  orderItemQuantityLabel,
  orderItemsCountLabel,
} from "../lib/order-item-presentation";

describe("order item presentation", () => {
  it("keeps legacy API items ticket-compatible", () => {
    const legacyItem = { quantity: 1 };

    expect(isTicketOrderItem(legacyItem)).toBe(true);
    expect(orderItemQuantityLabel(legacyItem)).toBe("1 billet");
  });

  it("labels boutique products as articles", () => {
    const shopItem = { quantity: 2, isTicket: false };

    expect(isTicketOrderItem(shopItem)).toBe(false);
    expect(orderItemQuantityLabel(shopItem)).toBe("2 articles");
    expect(orderItemsCountLabel([shopItem])).toBe("2 articles");
  });

  it("uses a generic article count for mixed orders", () => {
    expect(
      orderItemsCountLabel([
        { quantity: 2, isTicket: true },
        { quantity: 1, isTicket: false },
      ]),
    ).toBe("3 articles");
  });

  it("preserves ticket wording for ticket-only orders", () => {
    expect(
      orderItemsCountLabel([
        { quantity: 1, isTicket: true },
        { quantity: 2, isTicket: true },
      ]),
    ).toBe("3 billets");
  });
});

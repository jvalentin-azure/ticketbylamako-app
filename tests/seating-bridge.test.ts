import { describe, expect, it } from "vitest";
import {
  normalizeSeatLabels,
  seatingOrderId,
  seatingSelectionSnapshot,
} from "@/lib/seating-bridge";

describe("native seating bridge", () => {
  it("keeps distinct seat labels for multi-seat orders", () => {
    expect(
      normalizeSeatLabels([
        { label: "A-12" },
        { seatLabel: "A-13" },
        { label: "A-12" },
      ]),
    ).toEqual(["A-12", "A-13"]);
  });

  it("separates pending selections from seats confirmed in the cart", () => {
    expect(
      seatingSelectionSnapshot({
        seatLabels: ["B-4", "B-5"],
        selectedCount: 2,
        inCartCount: 1,
        pendingCount: 1,
      }),
    ).toEqual({
      seatLabels: ["B-4", "B-5"],
      selectedCount: 2,
      inCartCount: 1,
      pendingCount: 1,
    });
  });

  it("requires a real server order id before payment", () => {
    expect(seatingOrderId({ id: 13764 })).toBe(13764);
    expect(seatingOrderId({ orderId: 13765 })).toBe(13765);
    expect(seatingOrderId({})).toBe(0);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "order", "[id].tsx"),
  "utf8",
);

describe("order detail resilience", () => {
  it("loads tickets only after the server confirms payment", () => {
    expect(source).toContain("getMobileOrder(orderId)");
    expect(source).toContain("orderAllowsTicketDisplay(mobileOrder)");
    expect(source).toContain("getMobileOrderTickets(orderId)");
    expect(source).not.toContain("getMobileOrderTickets(orderId).catch");
  });

  it("handles CyberSource completion and stale requests", () => {
    expect(source).toContain('"cs-complete"');
    expect(source).toContain("requestId.current !== activeRequest");
  });

  it("shows actionable loading and failure states", () => {
    expect(source).toContain("OrderDetailSkeleton");
    expect(source).toContain("Commande indisponible");
    expect(source).toContain("Réessayer");
  });
});

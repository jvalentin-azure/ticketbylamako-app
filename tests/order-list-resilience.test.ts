import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/orders.tsx"), "utf8");
const authSource = fs.readFileSync(
  path.join(root, "lib/auth-provider.tsx"),
  "utf8",
);

describe("order history resilience", () => {
  it("uses a per-user persistent cache with refresh and retry states", () => {
    expect(source).toContain("order-list-v2-${userId}");
    expect(source).toContain("getCachedValue<OrderListItem[]>");
    expect(source).toContain("RefreshControl");
    expect(source).toContain("Réessayer");
    expect(source).toContain("OrderListSkeleton");
  });

  it("caches only the sanitized list model without billing data", () => {
    expect(source).toContain("interface OrderListItem");
    expect(source).not.toContain("order.billing");
    expect(source).not.toContain("customerNote");
    expect(source).not.toContain("transactionId");
  });

  it("uses the server ticket count and recognizes CyberSource completion", () => {
    expect(source).toContain("ticketCount: order.ticketCount || 0");
    expect(source).toContain('"cs-complete"');
    expect(source).not.toContain("extractTicketInfo");
  });

  it("clears persisted API caches on logout", () => {
    expect(authSource).toContain("await invalidateAllCaches()");
  });
});

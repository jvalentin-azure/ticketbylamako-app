import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const walletSource = fs.readFileSync(
  path.join(root, "app", "(tabs)", "tickets.tsx"),
  "utf8",
);
const detailSource = fs.readFileSync(
  path.join(root, "app", "ticket", "[id].tsx"),
  "utf8",
);
const authSource = fs.readFileSync(
  path.join(root, "lib", "auth-provider.tsx"),
  "utf8",
);

describe("offline ticket lifecycle", () => {
  it("preloads ready wallet tickets into encrypted detail storage", () => {
    expect(walletSource).toContain("setCachedTicketDetail(userId, order");
    expect(walletSource).toContain("order.ticketsReady && orderTickets.length > 0");
  });

  it("keeps the in-memory wallet visible when returning to the same account", () => {
    expect(walletSource).toContain("const walletUserId = useRef<number | null>(null)");
    expect(walletSource).toContain("const accountChanged = walletUserId.current !== userId");
    expect(walletSource).toContain("if (accountChanged) setTickets([])");
  });

  it("uses the local copy only for network failures", () => {
    expect(detailSource).toContain("getCachedTicketDetail(user.id, orderId)");
    expect(detailSource).toContain("error.status === 401");
    expect(detailSource).toContain("error.status === 403");
    expect(detailSource).toContain("setShowingOfflineCopy(true)");
  });

  it("purges encrypted ticket details on logout", () => {
    expect(authSource).toContain("clearTicketDetailCache(currentUserId)");
  });
});

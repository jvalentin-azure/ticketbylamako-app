import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

describe("ticket wallet resilience", () => {
  const screen = fs.readFileSync(
    path.join(root, "app", "(tabs)", "tickets.tsx"),
    "utf8",
  );
  const cache = fs.readFileSync(
    path.join(root, "lib", "api", "cache.ts"),
    "utf8",
  );

  it("restores non-sensitive summaries before refreshing the API", () => {
    expect(screen).toContain("getCachedValue<TicketItem[]>");
    expect(screen).toContain("setCache(cacheKey(userId), tix)");
    expect(cache).toContain("TICKETS: 10 * 60 * 1000");
  });

  it("does not persist QR ticket codes in the summary cache", () => {
    expect(screen).not.toContain("ticket.ticketCode");
  });

  it("shows actionable loading and error states", () => {
    expect(screen).toContain("TicketListSkeleton");
    expect(screen).toContain("Billets indisponibles");
    expect(screen).toContain("Réessayer");
    expect(screen).toContain('s === "cs-complete"');
  });

  it("opens the exact ticket instance and refreshes when the wallet regains focus", () => {
    expect(screen).toContain("useFocusEffect");
    expect(screen).toContain("ticketId: ticket.instanceId");
    expect(screen).toContain("setFilter(value)");
    expect(screen).toContain("PROCHAIN ÉVÉNEMENT");
  });
});

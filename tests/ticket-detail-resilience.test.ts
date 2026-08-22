import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const screen = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "ticket", "[id].tsx"),
  "utf8",
);

describe("ticket detail resilience", () => {
  it("loads order and ticket data in parallel", () => {
    expect(screen).toContain("await Promise.all([");
    expect(screen).toContain("getMobileOrder(orderId)");
    expect(screen).toContain("getMobileOrderTickets(orderId)");
  });

  it("accepts the CyberSource completed status", () => {
    expect(screen).toContain('"cs-complete": { label: "Validé"');
    expect(screen).toContain("ticketVisibleStatuses.has(order.status)");
  });

  it("offers skeleton and retry states", () => {
    expect(screen).toContain('accessibilityLabel="Chargement du billet"');
    expect(screen).toContain("Billet indisponible");
    expect(screen).toContain("Réessayer");
  });

  it("provides a focused offline entry mode without sharing the raw code", () => {
    expect(screen).toContain('useKeepAwake("ticket-entry-mode")');
    expect(screen).toContain("<SafeAreaProvider>");
    expect(screen).toContain('edges={["top", "right", "bottom", "left"]}');
    expect(screen).not.toContain("statusBarTranslucent");
    expect(screen).toContain("Mode entrée");
    expect(screen).toContain("disponible hors ligne");
    expect(screen).not.toContain("Share.share");
    expect(screen).not.toContain("Partager ce billet");
  });
});

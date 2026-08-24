import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("premium ticket experience", () => {
  it("keeps event navigation available while the event content scrolls", () => {
    const source = read("app/event/[id].tsx");

    expect(source).toContain('accessibilityLabel="Retour aux événements"');
    expect(source).toContain("styles.persistentBackButton");
    expect(source.indexOf("styles.persistentBackButton")).toBeLessThan(
      source.indexOf("<ScrollView"),
    );
  });

  it("offers a native calendar action from a valid ticket", () => {
    const source = read("app/ticket/[id].tsx");
    const calendar = read("lib/event-calendar.ts");
    const config = read("app.config.ts");

    expect(source).toContain("addTicketEventToCalendar");
    expect(source).toContain("Ajouter l'événement au calendrier");
    expect(calendar).toContain("Calendar.createEventInCalendarAsync");
    expect(config).toContain('"expo-calendar"');
  });

  it("shows wallet actions only when a signed provider is available", () => {
    const source = read("app/ticket/[id].tsx");
    const adapter = read("lib/order-adapters.ts");

    expect(source).toContain("ticket.apple_wallet_available === true");
    expect(source).toContain("ticket.google_wallet_available === true");
    expect(source).toContain("{walletAvailable ? (");
    expect(source).toContain("getMobileTicketWalletLink");
    expect(source).toContain("addTicketToNativeWallet(response.url)");
    expect(source).not.toContain("ticket.apple_wallet_url");
    expect(source).not.toContain("ticket.google_wallet_url");
    expect(adapter).toContain("appleWalletUrl");
    expect(adapter).toContain("googleWalletUrl");
    expect(adapter).toContain("appleWalletAvailable");
    expect(adapter).toContain("googleWalletAvailable");
  });

  it("distinguishes an active ticket from an already scanned ticket", () => {
    const source = read("app/ticket/[id].tsx");

    expect(source).toContain("Billet actif");
    expect(source).toContain("Billet déjà scanné");
    expect(source).toContain("ticket.checked_in === true");
    expect(source).toContain("QR conservé comme justificatif");
  });
});

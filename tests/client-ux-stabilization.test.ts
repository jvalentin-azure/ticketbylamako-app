import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(...segments: string[]) {
  return fs.readFileSync(path.join(root, ...segments), "utf8");
}

describe("client UX stabilization", () => {
  it("uses the least-privileged native calendar flow on iOS", () => {
    const calendar = read("lib", "event-calendar.ts");
    expect(calendar).toContain("Calendar.isAvailableAsync()");
    expect(calendar).toContain("Calendar.createEventInCalendarAsync");
    expect(calendar).toContain("CalendarPermissionDeniedError");
  });

  it("never skips the server ticket-field schema for event products", () => {
    const fields = read("lib", "checkout-fields.ts");
    const checkout = read("app", "checkout.tsx");
    expect(fields).toContain("return items.some((item) => item.isEvent)");
    expect(checkout).toContain("cartNeedsCheckoutFieldSchema(items)");
  });

  it("shows a structured payment summary with ticket count, seats and discount", () => {
    const payment = read("components", "payment", "PaymentScreenParts.tsx");
    const paymentStyles = read(
      "components",
      "payment",
      "payment-screen.styles.ts",
    );
    expect(payment).toContain("ticketCountBadge");
    expect(payment).toContain("item.seatLabels.join");
    expect(payment).toContain("Remise appliquée");
    expect(paymentStyles).toContain('fontWeight: "800"');
  });

  it("keeps the payment countdown when only the local cart expiry is available", () => {
    const hook = read("hooks", "use-mobile-payment.ts");
    expect(hook).toContain("expiresAt: cartExpiresAt");
    expect(hook).toContain("Number.isFinite(value)");
    expect(hook).toContain("Math.min(...expiryCandidates)");
  });

  it("preserves the original cart deadline when creating the checkout", () => {
    const checkout = read("app", "checkout.tsx");
    const api = read("lib", "api", "mobile.ts");
    expect(checkout).toContain("expiresAt: cartExpiresAt");
    expect(checkout).toContain("reservationExpiresAt: cartExpiresAt");
    expect(api).toContain("reservationExpiresAt?: string");
  });

  it("keeps cached catalogue data transparent to customers", () => {
    const home = read("app", "(tabs)", "index.tsx");
    const events = read("app", "(tabs)", "events.tsx");
    expect(home).not.toContain("Données enregistrées");
    expect(events).not.toContain("Données enregistrées");
    expect(home).toContain("Impossible de charger les événements");
    expect(events).toContain("Impossible de charger les événements");
  });
});

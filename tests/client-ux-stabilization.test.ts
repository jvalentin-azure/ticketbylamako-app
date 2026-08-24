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
    expect(payment).toContain("ticketCountBadge");
    expect(payment).toContain("item.seatLabels.join");
    expect(payment).toContain("Remise appliquée");
  });
});

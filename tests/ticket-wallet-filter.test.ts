import { describe, expect, it } from "vitest";
import { filterWalletTickets, sortWalletTickets } from "../lib/ticket-wallet";

const tickets = [
  { key: "future", eventName: "Futur", date: "2026-08-22T10:00:00Z" },
  { key: "past", eventName: "Passé", date: "2026-08-18T10:00:00Z" },
  { key: "today", eventName: "Aujourd'hui", date: "2026-08-21" },
];

describe("ticket wallet filters", () => {
  const now = Date.parse("2026-08-21T12:00:00Z");

  it("keeps date-only events visible until the end of their day", () => {
    expect(
      filterWalletTickets(tickets, "upcoming", now).map((ticket) => ticket.key),
    ).toEqual(["future", "today"]);
  });

  it("sorts upcoming events chronologically and past events most recent first", () => {
    expect(
      sortWalletTickets(
        filterWalletTickets(tickets, "upcoming", now),
        "upcoming",
        now,
      )[0]?.key,
    ).toBe("today");
    expect(
      sortWalletTickets(
        filterWalletTickets(tickets, "past", now),
        "past",
        now,
      )[0]?.key,
    ).toBe("past");
  });

  it("keeps an in-progress event in the active wallet until its end", () => {
    const inProgress = {
      key: "live",
      eventName: "En cours",
      date: "2026-08-21T10:00:00Z",
      endDate: "2026-08-21T18:00:00Z",
    };
    expect(filterWalletTickets([inProgress], "upcoming", now)).toEqual([
      inProgress,
    ]);
  });

  it("keeps timed legacy events available for a bounded grace period", () => {
    const legacy = {
      key: "legacy-live",
      eventName: "Événement sans date de fin",
      date: "2026-08-21T10:00:00Z",
    };
    expect(filterWalletTickets([legacy], "upcoming", now)).toEqual([legacy]);
  });
});

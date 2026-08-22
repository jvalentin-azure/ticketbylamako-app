import { describe, expect, it } from "vitest";
import {
  filterWalletTickets,
  groupWalletTickets,
  sortWalletTickets,
} from "../lib/ticket-wallet";

const baseTicket = {
  orderId: 10,
  eventId: 20,
  ticketType: "Standard",
};

const tickets = [
  {
    ...baseTicket,
    key: "future",
    eventName: "Futur",
    date: "2026-08-22T10:00:00Z",
  },
  {
    ...baseTicket,
    key: "past",
    eventName: "Passé",
    date: "2026-08-18T10:00:00Z",
  },
  { ...baseTicket, key: "today", eventName: "Aujourd'hui", date: "2026-08-21" },
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
      ...baseTicket,
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
      ...baseTicket,
      key: "legacy-live",
      eventName: "Événement sans date de fin",
      date: "2026-08-21T10:00:00Z",
    };
    expect(filterWalletTickets([legacy], "upcoming", now)).toEqual([legacy]);
  });

  it("groups seats from the same event and order into one wallet card", () => {
    const grouped = groupWalletTickets([
      {
        ...baseTicket,
        key: "c15",
        eventName: "Concert",
        date: "2026-08-22",
        seatLabel: "C15",
        eventImage: "https://example.com/poster.jpg",
      },
      {
        ...baseTicket,
        key: "c16",
        eventName: "Concert",
        date: "2026-08-22",
        seatLabel: "C16",
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.tickets).toHaveLength(2);
    expect(grouped[0]?.seatLabels).toEqual(["C15", "C16"]);
    expect(grouped[0]?.eventImage).toBe("https://example.com/poster.jpg");
  });

  it("keeps different orders in separate wallet cards", () => {
    const grouped = groupWalletTickets([
      { ...baseTicket, key: "first", eventName: "Concert", date: "2026-08-22" },
      {
        ...baseTicket,
        orderId: 11,
        key: "second",
        eventName: "Concert",
        date: "2026-08-22",
      },
    ]);

    expect(grouped).toHaveLength(2);
  });
});

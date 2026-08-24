import { describe, expect, it } from "vitest";
import {
  parseCachedTicketDetail,
  TICKET_DETAIL_CACHE_VERSION,
} from "../lib/ticket-detail-cache-parser";

const validPayload = {
  version: TICKET_DETAIL_CACHE_VERSION,
  cachedAt: 1_723_000_000_000,
  order: {
    id: 42,
    number: "42",
    status: "completed",
    paymentStatus: "success",
    ticketsReady: true,
  },
  tickets: {
    orderId: 42,
    orderStatus: "completed",
    ticketsReady: true,
    tickets: [{ instanceId: 7, ticketCode: "TBL-QR-7" }],
  },
};

describe("ticket detail cache validation", () => {
  it("accepts a cache entry scoped to the expected order", () => {
    expect(parseCachedTicketDetail(JSON.stringify(validPayload), 42)).toEqual(
      validPayload,
    );
  });

  it("rejects another order and malformed QR data", () => {
    expect(
      parseCachedTicketDetail(JSON.stringify(validPayload), 41),
    ).toBeNull();
    expect(
      parseCachedTicketDetail(
        JSON.stringify({
          ...validPayload,
          tickets: {
            ...validPayload.tickets,
            tickets: [{ instanceId: 7, ticketCode: "" }],
          },
        }),
        42,
      ),
    ).toBeNull();
  });

  it("rejects tickets that are not ready or belong to an invalid order", () => {
    expect(
      parseCachedTicketDetail(
        JSON.stringify({
          ...validPayload,
          tickets: { ...validPayload.tickets, ticketsReady: false },
        }),
        42,
      ),
    ).toBeNull();
    expect(
      parseCachedTicketDetail(
        JSON.stringify({
          ...validPayload,
          order: { ...validPayload.order, status: "refunded" },
        }),
        42,
      ),
    ).toBeNull();
  });

  it("rejects the previous cache shape so images and scan state refresh", () => {
    expect(
      parseCachedTicketDetail(
        JSON.stringify({ ...validPayload, version: 1 }),
        42,
      ),
    ).toBeNull();
  });
});

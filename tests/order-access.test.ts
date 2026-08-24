import { describe, expect, it } from "vitest";
import {
  orderAllowsTicketDisplay,
  orderPaymentPresentation,
} from "../lib/order-access";
import type { MobileOrderSummary } from "../lib/api/mobile";

function order(
  paymentStatus: MobileOrderSummary["paymentStatus"],
  ticketsReady: boolean,
): MobileOrderSummary {
  return {
    id: 42,
    number: "42",
    status: paymentStatus === "success" ? "processing" : "pending",
    paymentStatus,
    total: "300",
    currency: "MGA",
    dateCreated: "2026-08-24T10:00:00Z",
    datePaid: paymentStatus === "success" ? "2026-08-24T10:01:00Z" : null,
    paymentMethod: "mvola",
    paymentMethodTitle: "MVola",
    ticketsReady,
    ticketCount: ticketsReady ? 1 : 0,
    createdVia: "mobile",
  };
}

describe("paid ticket access", () => {
  it("allows a paid processing order when tickets are ready", () => {
    expect(orderAllowsTicketDisplay(order("success", true))).toBe(true);
  });

  it("blocks pending and paid orders whose tickets are not ready", () => {
    expect(orderAllowsTicketDisplay(order("pending", true))).toBe(false);
    expect(orderAllowsTicketDisplay(order("success", false))).toBe(false);
  });

  it("uses payment semantics instead of raw WooCommerce labels", () => {
    expect(orderPaymentPresentation(order("pending", false)).label).toBe(
      "Paiement à finaliser",
    );
    expect(orderPaymentPresentation(order("success", true)).label).toBe(
      "Payée · billets disponibles",
    );
  });
});

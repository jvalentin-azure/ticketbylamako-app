import type { MobileOrderSummary } from "@/lib/api/mobile";

type TicketAccessOrder = Pick<
  MobileOrderSummary,
  "paymentStatus" | "ticketsReady" | "ticketCount"
>;

export function orderHasConfirmedPayment(
  order: Pick<MobileOrderSummary, "paymentStatus">,
): boolean {
  return order.paymentStatus === "success";
}

export function orderAllowsTicketDisplay(order: TicketAccessOrder): boolean {
  return orderHasConfirmedPayment(order) && order.ticketsReady === true;
}

export function orderPaymentPresentation(order: MobileOrderSummary): {
  label: string;
  tone: "success" | "warning" | "danger" | "muted";
} {
  if (order.paymentStatus === "success") {
    return {
      label: order.ticketsReady ? "Payée · billets disponibles" : "Payée",
      tone: "success",
    };
  }
  if (order.requiresManualReview || order.paymentStatus === "review") {
    return { label: "Vérification en cours", tone: "warning" };
  }
  if (order.paymentStatus === "pending") {
    return { label: "Paiement à finaliser", tone: "warning" };
  }
  if (["failed", "cancelled", "expired"].includes(order.paymentStatus)) {
    return { label: "Paiement non abouti", tone: "danger" };
  }
  return { label: "Statut indisponible", tone: "muted" };
}

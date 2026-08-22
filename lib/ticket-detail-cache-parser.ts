import type {
  MobileOrderSummary,
  MobileOrderTicketsResponse,
} from "@/lib/api/mobile";

export const TICKET_DETAIL_CACHE_VERSION = 2;
const CACHEABLE_ORDER_STATUSES = new Set([
  "completed",
  "processing",
  "cs-complete",
]);

export interface CachedTicketDetail {
  version: typeof TICKET_DETAIL_CACHE_VERSION;
  cachedAt: number;
  order: MobileOrderSummary;
  tickets: MobileOrderTicketsResponse;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function parseCachedTicketDetail(
  serialized: string | null,
  expectedOrderId: number,
): CachedTicketDetail | null {
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Partial<CachedTicketDetail>;
    if (
      value.version !== TICKET_DETAIL_CACHE_VERSION ||
      typeof value.cachedAt !== "number" ||
      !value.order ||
      value.order.id !== expectedOrderId ||
      !CACHEABLE_ORDER_STATUSES.has(value.order.status || "") ||
      !value.tickets ||
      value.tickets.orderId !== expectedOrderId ||
      value.tickets.ticketsReady !== true ||
      !Array.isArray(value.tickets.tickets) ||
      value.tickets.tickets.some(
        (ticket) =>
          !isPositiveInteger(ticket.instanceId) ||
          typeof ticket.ticketCode !== "string" ||
          ticket.ticketCode.length === 0,
      )
    ) {
      return null;
    }

    return value as CachedTicketDetail;
  } catch {
    return null;
  }
}

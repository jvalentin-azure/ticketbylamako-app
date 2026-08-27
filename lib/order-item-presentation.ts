import type { MobileOrderItem } from "@/lib/api/mobile";

type OrderItemPresentationInput = Pick<
  MobileOrderItem,
  "isTicket" | "quantity"
>;

export function isTicketOrderItem(item: OrderItemPresentationInput): boolean {
  // Older API responses did not expose isTicket and only served ticket carts.
  return item.isTicket !== false;
}

export function orderItemQuantityLabel(
  item: OrderItemPresentationInput,
): string {
  const quantity = Number(item.quantity || 0);
  const noun = isTicketOrderItem(item) ? "billet" : "article";
  return `${quantity} ${noun}${quantity > 1 ? "s" : ""}`;
}

export function orderItemsCountLabel(
  items: OrderItemPresentationInput[],
): string {
  const quantity = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );
  const ticketsOnly = items.length > 0 && items.every(isTicketOrderItem);
  const noun = ticketsOnly ? "billet" : "article";
  return `${quantity} ${noun}${quantity > 1 ? "s" : ""}`;
}

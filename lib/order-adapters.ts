import type { MobileOrderSummary, MobileTicket } from "@/lib/api/mobile";
import type { WCOrder, TicketInstance } from "@/lib/types/commerce";

export function mobileOrderToWCOrder(order: MobileOrderSummary): WCOrder {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    total: order.total,
    subtotal: order.subtotal || undefined,
    total_tax: order.totalTax || undefined,
    discount_total: order.discountTotal || undefined,
    shipping_total: order.shippingTotal || undefined,
    currency: order.currency,
    date_created: order.dateCreated || "",
    date_paid: order.datePaid || undefined,
    payment_method: order.paymentMethod,
    payment_method_title: order.paymentMethodTitle,
    transaction_id: order.transactionId || undefined,
    customer_note: order.customerNote || undefined,
    billing: {
      first_name: order.billing?.firstName || "",
      last_name: order.billing?.lastName || "",
      email: order.billing?.email || "",
      phone: order.billing?.phone || "",
    },
    line_items: (order.items || []).map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      total: item.total,
      subtotal: item.subtotal,
      price: item.price,
      product_id: item.productId,
      sku: item.sku,
      meta_data: [],
    })),
    meta_data: [],
  };
}

export function mobileTicketToTicketInstance(ticket: MobileTicket): TicketInstance {
  return {
    instance_id: ticket.instanceId,
    ticket_code: ticket.ticketCode,
    product_name: ticket.productName,
    product_id: ticket.productId,
    price: ticket.price || 0,
    seat_label: ticket.seatLabel || "",
    seat_id: ticket.seatId || "",
    event_id: ticket.eventId,
    event_name: ticket.eventName || "",
    event_date: ticket.eventDate || "",
    event_location: ticket.eventLocation || "",
  };
}

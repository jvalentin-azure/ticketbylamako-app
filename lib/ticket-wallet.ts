export type TicketWalletFilter = "upcoming" | "past" | "all";

export interface WalletTicketLike {
  key: string;
  orderId: number;
  eventId: number;
  eventName: string;
  ticketType: string;
  date: string;
  endDate?: string;
  seatLabel?: string;
  eventLocation?: string;
}

export interface WalletTicketGroup<T extends WalletTicketLike> {
  key: string;
  orderId: number;
  eventId: number;
  eventName: string;
  date: string;
  endDate?: string;
  eventLocation?: string;
  tickets: T[];
  ticketTypes: string[];
  seatLabels: string[];
}

const EVENT_START_GRACE_MS = 24 * 60 * 60 * 1000;

export function ticketTimestamp(date: string): number | null {
  if (!date) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T23:59:59`
    : date;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isPastWalletTicket(
  ticket: Pick<WalletTicketLike, "date" | "endDate">,
  now = Date.now(),
): boolean {
  const endTimestamp = ticketTimestamp(ticket.endDate || "");
  if (endTimestamp !== null) return endTimestamp < now;

  const startTimestamp = ticketTimestamp(ticket.date);
  if (startTimestamp === null) return false;
  const hasExplicitTime = /[T\s]\d{1,2}:\d{2}/.test(ticket.date);
  const expiryTimestamp = hasExplicitTime
    ? startTimestamp + EVENT_START_GRACE_MS
    : startTimestamp;
  return expiryTimestamp < now;
}

export function filterWalletTickets<T extends WalletTicketLike>(
  tickets: T[],
  filter: TicketWalletFilter,
  now = Date.now(),
): T[] {
  if (filter === "all") return [...tickets];
  return tickets.filter((ticket) =>
    filter === "past"
      ? isPastWalletTicket(ticket, now)
      : !isPastWalletTicket(ticket, now),
  );
}

export function sortWalletTickets<T extends WalletTicketLike>(
  tickets: T[],
  filter: TicketWalletFilter,
  now = Date.now(),
): T[] {
  const direction = filter === "past" ? -1 : 1;
  return [...tickets].sort((left, right) => {
    const leftTime = ticketTimestamp(left.date);
    const rightTime = ticketTimestamp(right.date);
    if (leftTime === null && rightTime === null) {
      return left.eventName.localeCompare(right.eventName, "fr");
    }
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;
    const leftDistance = filter === "all" ? Math.abs(leftTime - now) : leftTime;
    const rightDistance =
      filter === "all" ? Math.abs(rightTime - now) : rightTime;
    return (leftDistance - rightDistance) * direction;
  });
}

export function groupWalletTickets<T extends WalletTicketLike>(
  tickets: T[],
): WalletTicketGroup<T>[] {
  const groups = new Map<string, WalletTicketGroup<T>>();

  for (const ticket of tickets) {
    const eventIdentity =
      ticket.eventId > 0
        ? String(ticket.eventId)
        : ticket.eventName.trim().toLocaleLowerCase("fr");
    const key = `${ticket.orderId}:${eventIdentity}`;
    const existing = groups.get(key);

    if (existing) {
      existing.tickets.push(ticket);
      if (
        ticket.ticketType &&
        !existing.ticketTypes.includes(ticket.ticketType)
      ) {
        existing.ticketTypes.push(ticket.ticketType);
      }
      if (ticket.seatLabel && !existing.seatLabels.includes(ticket.seatLabel)) {
        existing.seatLabels.push(ticket.seatLabel);
      }
      continue;
    }

    groups.set(key, {
      key,
      orderId: ticket.orderId,
      eventId: ticket.eventId,
      eventName: ticket.eventName,
      date: ticket.date,
      endDate: ticket.endDate,
      eventLocation: ticket.eventLocation,
      tickets: [ticket],
      ticketTypes: ticket.ticketType ? [ticket.ticketType] : [],
      seatLabels: ticket.seatLabel ? [ticket.seatLabel] : [],
    });
  }

  return [...groups.values()];
}

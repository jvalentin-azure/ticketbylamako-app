export type TicketWalletFilter = "upcoming" | "past" | "all";

export interface WalletTicketLike {
  key: string;
  eventName: string;
  date: string;
}

export function ticketTimestamp(date: string): number | null {
  if (!date) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T23:59:59`
    : date;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isPastWalletTicket(
  ticket: Pick<WalletTicketLike, "date">,
  now = Date.now(),
): boolean {
  const timestamp = ticketTimestamp(ticket.date);
  return timestamp !== null && timestamp < now;
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

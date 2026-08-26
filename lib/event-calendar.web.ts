export interface CalendarTicketEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  notes?: string;
}

export class CalendarPermissionDeniedError extends Error {
  constructor() {
    super("L'accès au calendrier est désactivé pour TicketByLamako.");
    this.name = "CalendarPermissionDeniedError";
  }
}

function parseEventDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value.trim().replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function icsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function addTicketEventToCalendar(
  event: CalendarTicketEvent,
): Promise<"created" | "cancelled"> {
  const startDate = parseEventDate(event.startDate);
  if (!startDate) {
    throw new Error("La date de cet événement n'est pas disponible.");
  }
  const explicitEndDate = parseEventDate(event.endDate);
  const endDate =
    explicitEndDate && explicitEndDate > startDate
      ? explicitEndDate
      : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
  const uid = `ticketbylamako-${startDate.getTime()}@ticketbylamako.com`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TicketByLamako//Mobile Web//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(startDate)}`,
    `DTEND:${icsDate(endDate)}`,
    `SUMMARY:${icsText(event.title)}`,
    event.location ? `LOCATION:${icsText(event.location)}` : "",
    event.notes ? `DESCRIPTION:${icsText(event.notes)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([`${lines.join("\r\n")}\r\n`], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ticketbylamako-evenement.ics";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return "created";
}

import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

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
  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function addTicketEventToCalendar(
  event: CalendarTicketEvent,
): Promise<"created" | "cancelled"> {
  const startDate = parseEventDate(event.startDate);
  if (!startDate) {
    throw new Error("La date de cet événement n'est pas disponible.");
  }

  if (!(await Calendar.isAvailableAsync())) {
    throw new Error("Le calendrier n'est pas disponible sur cet appareil.");
  }

  const explicitEndDate = parseEventDate(event.endDate);
  const endDate =
    explicitEndDate && explicitEndDate > startDate
      ? explicitEndDate
      : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  if (Platform.OS === "ios") {
    // The native event editor is the least-privileged iOS flow: the user sees
    // and confirms the event without granting broad calendar access first.
    const result = await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate,
      endDate,
      location: event.location || undefined,
      notes: event.notes || undefined,
      alarms: [{ relativeOffset: -60 }],
    });
    return result.action === "saved" ? "created" : "cancelled";
  }

  let permission = await Calendar.getCalendarPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain) {
    permission = await Calendar.requestCalendarPermissionsAsync();
  }
  if (permission.status !== "granted") {
    throw new CalendarPermissionDeniedError();
  }

  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  await Calendar.createEventAsync(defaultCalendar.id, {
    title: event.title,
    startDate,
    endDate,
    location: event.location || undefined,
    notes: event.notes || undefined,
    alarms: [{ relativeOffset: -60 }],
  });
  return "created";
}

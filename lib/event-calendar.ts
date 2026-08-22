import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

export interface CalendarTicketEvent {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  notes?: string;
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

  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error(
      "Autorisez TicketByLamako à accéder au calendrier pour ajouter cet événement.",
    );
  }

  const explicitEndDate = parseEventDate(event.endDate);
  const endDate =
    explicitEndDate && explicitEndDate > startDate
      ? explicitEndDate
      : new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  if (Platform.OS === "ios") {
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

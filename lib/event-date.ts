import type { MobileFields } from "@/lib/types/commerce";

export const EVENT_TIME_ZONE = "Indian/Antananarivo";
export const EVENT_DATE_UNAVAILABLE_LABEL = "Date à confirmer";

export interface EventDateSource {
  /** WordPress publication timestamp; accepted structurally but never read. */
  date?: unknown;
  mobileFields?: Partial<MobileFields> | null;
  event_date_time?: unknown;
  _event_date_time?: unknown;
  event_start_date?: unknown;
  _event_start_date?: unknown;
  event_end_date_time?: unknown;
  _event_end_date_time?: unknown;
  event_end_date?: unknown;
  _event_end_date?: unknown;
  eventDate?: unknown;
  startDate?: unknown;
  lamako_mobile?: {
    event_date_time?: unknown;
    event_end_date_time?: unknown;
  } | null;
}

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Returns the contractual event start value. `event.date` is deliberately
 * excluded because WordPress uses it for the post publication timestamp.
 */
export function getEventStartDateValue(event: EventDateSource): string | null {
  return (
    nonEmptyString(event.mobileFields?.event_date_time) ||
    nonEmptyString(event.lamako_mobile?.event_date_time) ||
    nonEmptyString(event.event_date_time) ||
    nonEmptyString(event._event_date_time) ||
    nonEmptyString(event.event_start_date) ||
    nonEmptyString(event._event_start_date) ||
    nonEmptyString(event.eventDate) ||
    nonEmptyString(event.startDate)
  );
}

export function getEventEndDateValue(event: EventDateSource): string | null {
  return (
    nonEmptyString(event.mobileFields?.event_end_date_time) ||
    nonEmptyString(event.lamako_mobile?.event_end_date_time) ||
    nonEmptyString(event.event_end_date_time) ||
    nonEmptyString(event._event_end_date_time) ||
    nonEmptyString(event.event_end_date) ||
    nonEmptyString(event._event_end_date)
  );
}

function parseWallClock(value: string): WallClockParts | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;

  const parts: WallClockParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  };
  const utc = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  if (
    utc.getUTCFullYear() !== parts.year ||
    utc.getUTCMonth() + 1 !== parts.month ||
    utc.getUTCDate() !== parts.day ||
    utc.getUTCHours() !== parts.hour ||
    utc.getUTCMinutes() !== parts.minute ||
    utc.getUTCSeconds() !== parts.second
  ) {
    return null;
  }
  return parts;
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const existing = formatterCache.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date: Date, timeZone: string): WallClockParts | null {
  try {
    const values = Object.fromEntries(
      formatterFor(timeZone)
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    return {
      year: values.year,
      month: values.month,
      day: values.day,
      hour: values.hour,
      minute: values.minute,
      second: values.second,
    };
  } catch {
    return null;
  }
}

function sameWallClock(a: WallClockParts, b: WallClockParts): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number | null {
  const parts = zonedParts(instant, timeZone);
  if (!parts) return null;
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant.getTime()
  );
}

/**
 * Parses ISO timestamps as absolute instants and legacy MySQL wall-clock
 * values in the supplied IANA timezone. The round-trip rejects invalid dates
 * and non-existent local times during a DST jump.
 */
export function parseEventDateValue(
  value: string | null | undefined,
  timeZone = EVENT_TIME_ZONE,
): Date | null {
  const normalized = nonEmptyString(value);
  if (!normalized) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    const absolute = new Date(normalized.replace(" ", "T"));
    return Number.isNaN(absolute.getTime()) ? null : absolute;
  }

  const wallClock = parseWallClock(normalized);
  if (!wallClock) return null;

  const wallClockAsUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  let instantMs = wallClockAsUtc;

  // Recalculate because the first estimate may sit on the other side of a
  // daylight-saving transition in timezones that observe DST.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = timeZoneOffsetMs(new Date(instantMs), timeZone);
    if (offset === null) return null;
    const next = wallClockAsUtc - offset;
    if (next === instantMs) break;
    instantMs = next;
  }

  const instant = new Date(instantMs);
  const roundTrip = zonedParts(instant, timeZone);
  return roundTrip && sameWallClock(roundTrip, wallClock) ? instant : null;
}

export function getEventStartDate(
  event: EventDateSource,
  timeZone = EVENT_TIME_ZONE,
): Date | null {
  return parseEventDateValue(getEventStartDateValue(event), timeZone);
}

export function formatEventDate(
  event: EventDateSource,
  timeZone = EVENT_TIME_ZONE,
): string {
  const date = getEventStartDate(event, timeZone);
  if (!date) return EVENT_DATE_UNAVAILABLE_LABEL;
  return date.toLocaleDateString("fr-FR", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatEventDateShort(
  event: EventDateSource,
  timeZone = EVENT_TIME_ZONE,
): string {
  const date = getEventStartDate(event, timeZone);
  if (!date) return EVENT_DATE_UNAVAILABLE_LABEL;
  return date.toLocaleDateString("fr-FR", {
    timeZone,
    day: "numeric",
    month: "short",
  });
}

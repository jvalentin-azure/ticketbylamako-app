import { describe, expect, it } from "vitest";

import {
  EVENT_DATE_UNAVAILABLE_LABEL,
  formatEventDate,
  getEventStartDate,
  getEventStartDateValue,
  parseEventDateValue,
} from "@/lib/event-date";

describe("event date contract", () => {
  it("interprets the Tickera wall clock in Madagascar instead of browser time", () => {
    expect(parseEventDateValue("2026-06-27 19:30:00")?.toISOString()).toBe(
      "2026-06-27T16:30:00.000Z",
    );
  });

  it("keeps UTC and offset-bearing timestamps as absolute instants", () => {
    expect(parseEventDateValue("2026-06-27T16:30:00Z")?.toISOString()).toBe(
      "2026-06-27T16:30:00.000Z",
    );
    expect(
      parseEventDateValue("2026-06-27T19:30:00+03:00")?.toISOString(),
    ).toBe("2026-06-27T16:30:00.000Z");
  });

  it("prioritizes the v2 contract and supports bounded legacy date fields", () => {
    const source = {
      date: "2026-06-06T09:00:00Z",
      mobileFields: { event_date_time: "2026-06-27 19:30:00" },
      lamako_mobile: { event_date_time: "2026-06-28 19:30:00" },
      _event_date_time: "2026-06-29 19:30:00",
    };
    expect(getEventStartDateValue(source)).toBe("2026-06-27 19:30:00");
    expect(getEventStartDate(source)?.toISOString()).toBe(
      "2026-06-27T16:30:00.000Z",
    );

    expect(
      getEventStartDateValue({
        lamako_mobile: { event_date_time: "2026-06-28 10:00:00" },
      }),
    ).toBe("2026-06-28 10:00:00");
    expect(
      getEventStartDateValue({ _event_date_time: "2026-06-29 10:00:00" }),
    ).toBe("2026-06-29 10:00:00");
    expect(
      getEventStartDateValue({ event_start_date: "2026-06-30 10:00:00" }),
    ).toBe("2026-06-30 10:00:00");
    expect(getEventStartDateValue({ eventDate: "2026-07-01 10:00:00" })).toBe(
      "2026-07-01 10:00:00",
    );
  });

  it("never treats the WordPress publication date as the event date", () => {
    const publicationOnly = { date: "2026-06-06T09:00:00Z" };
    expect(getEventStartDateValue(publicationOnly)).toBeNull();
    expect(getEventStartDate(publicationOnly)).toBeNull();
    expect(formatEventDate(publicationOnly)).toBe(EVENT_DATE_UNAVAILABLE_LABEL);
  });

  it("handles daylight-saving offsets and rejects a missing local hour", () => {
    expect(
      parseEventDateValue("2026-01-15 12:00:00", "Europe/Paris")?.toISOString(),
    ).toBe("2026-01-15T11:00:00.000Z");
    expect(
      parseEventDateValue("2026-07-15 12:00:00", "Europe/Paris")?.toISOString(),
    ).toBe("2026-07-15T10:00:00.000Z");
    expect(
      parseEventDateValue("2026-03-29 02:30:00", "Europe/Paris"),
    ).toBeNull();
  });

  it("rejects impossible dates and malformed input", () => {
    expect(parseEventDateValue("2026-02-30 12:00:00")).toBeNull();
    expect(parseEventDateValue("not-a-date")).toBeNull();
  });
});

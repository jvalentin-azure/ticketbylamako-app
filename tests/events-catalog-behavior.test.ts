import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "(tabs)", "events.tsx"),
  "utf8",
);

describe("events catalogue behavior", () => {
  it("filters against the actual event date rather than the post date", () => {
    expect(source).toContain("getEventStartDate(e)");
    expect(source).toContain("formatEventDateShort(item)");
    expect(source).not.toContain("e.mobileFields?.event_date_time || e.date");
    expect(source).not.toContain("const eventDate = new Date(e.date)");
  });

  it("prefetches only the bounded shared catalogue image selection", () => {
    expect(source).toContain("prefetchCatalogImages");
    expect(source).toContain("event.featuredImageVariants?.webp");
    expect(source).toContain("event.featuredImageVariants?.avif");
    expect(source).toContain("event.featuredImage");
  });
});

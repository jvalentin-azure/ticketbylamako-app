import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("event detail related events", () => {
  it("reuses the shared 4:5 event card instead of the legacy landscape card", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app", "event", "[id].tsx"),
      "utf8",
    );

    expect(source).toContain('import { EventPosterCard }');
    expect(source).toContain("<EventPosterCard");
    expect(source).toContain('favorite={isFavorite(item.id, "event")}');
    expect(source).not.toContain("styles.upcomingCardImage");
    expect(source).not.toContain("upcomingCardImage:");
  });

  it("uses the resilient catalog image renderer for the hero and gallery", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app", "event", "[id].tsx"),
      "utf8",
    );

    expect(source).toContain('import { CatalogImage }');
    expect(source).toContain('recyclingKey={`event-gallery-${event.id}-${item}`}');
    expect(source).toContain('recyclingKey={`event-featured-${event.id}`}');
    expect(source).not.toContain('import { Image } from "expo-image"');
  });
});

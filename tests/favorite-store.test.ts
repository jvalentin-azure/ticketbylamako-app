import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeStoredFavorites, parseStoredFavorites } from "../lib/favorite-store";

const favoritesScreenSource = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "favorites.tsx"),
  "utf8",
);

const favorite = {
  id: 12,
  type: "event" as const,
  name: "Concert test",
  image: "https://example.com/event.jpg",
  addedAt: "2026-08-21T10:00:00.000Z",
};

describe("favorite storage", () => {
  it("restores a valid favorite", () => {
    expect(parseStoredFavorites(JSON.stringify([favorite]))).toEqual([favorite]);
  });

  it("rejects malformed storage without throwing", () => {
    expect(parseStoredFavorites("not-json")).toEqual([]);
    expect(parseStoredFavorites(JSON.stringify({ favorite }))).toEqual([]);
  });

  it("removes malformed and duplicate favorites", () => {
    expect(
      normalizeStoredFavorites([
        favorite,
        { ...favorite, name: "Duplicate" },
        { ...favorite, id: 0 },
      ]),
    ).toEqual([favorite]);
  });

  it("renders saved catalog images with the shared resilient component", () => {
    expect(favoritesScreenSource).toContain('import { CatalogImage }');
    expect(favoritesScreenSource).toContain("<CatalogImage");
    expect(favoritesScreenSource).not.toContain('from "expo-image"');
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "search.tsx"),
  "utf8",
);

describe("search resilience", () => {
  it("loads event and shop data concurrently", () => {
    expect(source).toContain("await Promise.all");
    expect(source).toContain("getEventsData({ forceRefresh })");
    expect(source).toContain("getShopData({ forceRefresh })");
  });

  it("does not show a false empty result while loading", () => {
    expect(source).toContain("dataLoading ?");
    expect(source).toContain("searchSkeleton");
  });

  it("offers a forced retry and ignores stale requests", () => {
    expect(source).toContain("loadSearchData(true)");
    expect(source).toContain("dataRequestId.current !== activeRequest");
    expect(source).toContain("Recherche indisponible");
  });

  it("uses resilient catalog images and the business event date", () => {
    expect(source).toContain('import { CatalogImage }');
    expect(source).toContain("<CatalogImage");
    expect(source).not.toContain('from "expo-image"');
    expect(source).toContain("e.mobileFields?.event_date_time || e.date");
  });
});

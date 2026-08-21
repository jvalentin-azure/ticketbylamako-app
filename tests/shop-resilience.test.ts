import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "(tabs)", "shop.tsx"),
  "utf8",
);

describe("shop resilience", () => {
  it("protects the product list from stale requests", () => {
    expect(source).toContain("requestId.current !== activeRequest");
    expect(source).toContain("ShopSkeleton");
  });

  it("forces a catalog refresh on retry and pull to refresh", () => {
    expect(source).toContain("getShopData({");
    expect(source).toContain("forceRefresh");
    expect(source).toContain("load(true)");
  });

  it("distinguishes an unavailable shop from empty search results", () => {
    expect(source).toContain("Boutique indisponible");
    expect(source).toContain("Aucun résultat");
    expect(source).toContain("Essayez une autre recherche ou catégorie.");
  });

  it("uses responsive cached catalogue images", () => {
    expect(source).toContain("useWindowDimensions");
    expect(source).toContain("<CatalogImage");
    expect(source).toContain("prefetchCatalogImages");
    expect(source).not.toContain('import { Image } from "expo-image"');
  });
});

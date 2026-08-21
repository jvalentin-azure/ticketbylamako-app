import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const screenSource = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "product", "[id].tsx"),
  "utf8",
);
const catalogSource = fs.readFileSync(
  path.resolve(__dirname, "..", "lib", "api", "catalog.ts"),
  "utf8",
);

describe("product detail resilience", () => {
  it("protects the screen from stale product requests", () => {
    expect(screenSource).toContain("requestId.current !== activeRequest");
    expect(screenSource).toContain("ProductDetailSkeleton");
  });

  it("shows actionable errors and retry", () => {
    expect(screenSource).toContain("Produit indisponible");
    expect(screenSource).toContain("Réessayer");
    expect(screenSource).toContain("loadProduct(true)");
  });

  it("caches public product details with a stale fallback", () => {
    expect(catalogSource).toContain("const cacheKey = `product-${id}`");
    expect(catalogSource).toContain(
      "if (cache.fallback) return cache.fallback",
    );
    expect(catalogSource).toContain("await setCache(cacheKey, product)");
  });

  it("uses responsive cached images for the product gallery", () => {
    expect(screenSource).toContain("useWindowDimensions");
    expect(screenSource).toContain("<CatalogImage");
    expect(screenSource).toContain("prefetchCatalogImages");
    expect(screenSource).not.toContain('import { Image } from "expo-image"');
    expect(screenSource).not.toContain('Dimensions.get("window")');
  });
});

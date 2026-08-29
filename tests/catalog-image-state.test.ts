import { describe, expect, it } from "vitest";

import {
  CATALOG_IMAGE_BLURHASH,
  CATALOG_IMAGE_PLACEHOLDER,
  LEGACY_CATALOG_IMAGE_HASH,
  isRawBlurhash,
  resolveCatalogImageSources,
} from "@/lib/catalog-image-state";

describe("catalog image source resolution", () => {
  it("passes the BlurHash through the placeholder contract, never a URI", () => {
    expect(isRawBlurhash(CATALOG_IMAGE_BLURHASH)).toBe(true);
    expect(CATALOG_IMAGE_PLACEHOLDER).toEqual({
      blurhash: CATALOG_IMAGE_BLURHASH,
    });
    expect(resolveCatalogImageSources(CATALOG_IMAGE_BLURHASH, null)).toEqual({
      preferredUri: null,
      fallbackUri: null,
    });
    expect(isRawBlurhash(LEGACY_CATALOG_IMAGE_HASH)).toBe(true);
    expect(resolveCatalogImageSources(LEGACY_CATALOG_IMAGE_HASH, null)).toEqual(
      {
        preferredUri: null,
        fallbackUri: null,
      },
    );
    expect(
      resolveCatalogImageSources(`blurhash:/${CATALOG_IMAGE_BLURHASH}`, null),
    ).toEqual({ preferredUri: null, fallbackUri: null });
  });

  it("prefers the optimized network URL and keeps the original as fallback", () => {
    expect(
      resolveCatalogImageSources(
        "https://cdn.example/event.webp",
        "https://cdn.example/event.jpg",
      ),
    ).toEqual({
      preferredUri: "https://cdn.example/event.webp",
      fallbackUri: "https://cdn.example/event.jpg",
    });
  });

  it("uses the real original when the optimized value is a hash", () => {
    expect(
      resolveCatalogImageSources(
        LEGACY_CATALOG_IMAGE_HASH,
        "https://cdn.example/event.jpg",
      ),
    ).toEqual({
      preferredUri: "https://cdn.example/event.jpg",
      fallbackUri: null,
    });
  });

  it("rejects invalid or empty sources without misclassifying ordinary URLs", () => {
    expect(isRawBlurhash("https://cdn.example/event.jpg")).toBe(false);
    expect(resolveCatalogImageSources(" ", "")).toEqual({
      preferredUri: null,
      fallbackUri: null,
    });
  });
});

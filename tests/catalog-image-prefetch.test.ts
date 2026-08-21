import { describe, expect, it, vi } from "vitest";

const { prefetch } = vi.hoisted(() => ({ prefetch: vi.fn() }));

vi.mock("expo-image", () => ({
  Image: { prefetch },
}));

import {
  prefetchCatalogImages,
  selectCatalogImageUrls,
} from "../lib/catalog-image-prefetch";

describe("catalog image prefetch", () => {
  it("keeps only three unique secure image URLs", () => {
    expect(
      selectCatalogImageUrls([
        "https://example.com/one.jpg",
        "  https://example.com/one.jpg  ",
        "http://example.com/insecure.jpg",
        undefined,
        "https://example.com/two.jpg",
        "https://example.com/three.jpg",
        "https://example.com/four.jpg",
      ]),
    ).toEqual([
      "https://example.com/one.jpg",
      "https://example.com/two.jpg",
      "https://example.com/three.jpg",
    ]);
  });

  it("uses the same memory-disk cache as catalogue cards", async () => {
    prefetch.mockResolvedValueOnce(true);

    await expect(
      prefetchCatalogImages(["https://example.com/poster.jpg"]),
    ).resolves.toBe(true);
    expect(prefetch).toHaveBeenCalledWith(
      ["https://example.com/poster.jpg"],
      "memory-disk",
    );
  });

  it("does not turn a prefetch failure into a catalogue error", async () => {
    prefetch.mockRejectedValueOnce(new Error("network"));

    await expect(
      prefetchCatalogImages(["https://example.com/poster.jpg"]),
    ).resolves.toBe(false);
  });
});

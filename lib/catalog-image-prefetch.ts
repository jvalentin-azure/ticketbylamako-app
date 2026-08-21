import { Image } from "expo-image";

const MAX_CATALOG_PREFETCH_IMAGES = 3;

export function selectCatalogImageUrls(
  urls: Array<string | null | undefined>,
  limit = MAX_CATALOG_PREFETCH_IMAGES,
): string[] {
  return Array.from(
    new Set(
      urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter((url) => /^https:\/\//i.test(url)),
    ),
  ).slice(0, Math.max(0, limit));
}

export async function prefetchCatalogImages(
  urls: Array<string | null | undefined>,
): Promise<boolean> {
  const selected = selectCatalogImageUrls(urls);
  if (!selected.length) return true;

  try {
    return await Image.prefetch(selected, "memory-disk");
  } catch {
    // Image prefetching improves perceived speed but must never block catalogue data.
    return false;
  }
}

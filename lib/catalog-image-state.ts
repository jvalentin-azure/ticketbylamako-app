const BLURHASH_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

// A valid 4x3 BlurHash. The previous placeholder string is also recognized
// below so it can never be promoted to a network URI again.
export const CATALOG_IMAGE_BLURHASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";
export const LEGACY_CATALOG_IMAGE_HASH = "|rF?hV%2WCj[ayj[a|j[azj[ayj[";
export const CATALOG_IMAGE_PLACEHOLDER = {
  blurhash: CATALOG_IMAGE_BLURHASH,
} as const;

export function isRawBlurhash(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized.length < 6 || normalized.includes("://")) return false;
  if (
    ![...normalized].every((character) => BLURHASH_ALPHABET.includes(character))
  ) {
    return false;
  }

  const sizeFlag = BLURHASH_ALPHABET.indexOf(normalized[0]);
  if (sizeFlag < 0) return false;
  const componentsX = (sizeFlag % 9) + 1;
  const componentsY = Math.floor(sizeFlag / 9) + 1;
  const expectedLength = 4 + 2 * componentsX * componentsY;
  if (normalized.length === expectedLength) return true;

  // Compatibility quarantine for the exact historical Expo sample hash. It
  // fails strict dimension validation but must never become a network URL.
  return normalized === LEGACY_CATALOG_IMAGE_HASH;
}

function imageUri(value: string | null | undefined): string | null {
  const normalized = value?.trim() || null;
  if (
    !normalized ||
    isRawBlurhash(normalized) ||
    normalized.startsWith("blurhash:/")
  ) {
    return null;
  }
  return normalized;
}

export function resolveCatalogImageSources(
  optimizedUri?: string | null,
  originalUri?: string | null,
): { preferredUri: string | null; fallbackUri: string | null } {
  const optimized = imageUri(optimizedUri);
  const original = imageUri(originalUri);
  return {
    preferredUri: optimized || original,
    fallbackUri:
      optimized && original && optimized !== original ? original : null,
  };
}

export interface FavoriteItem {
  id: number;
  type: "event" | "product";
  name: string;
  image?: string;
  addedAt: string;
}

function isFavoriteItem(value: unknown): value is FavoriteItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FavoriteItem>;
  return (
    typeof item.id === "number" &&
    Number.isFinite(item.id) &&
    item.id > 0 &&
    (item.type === "event" || item.type === "product") &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    (item.image === undefined || typeof item.image === "string") &&
    typeof item.addedAt === "string" &&
    !Number.isNaN(Date.parse(item.addedAt))
  );
}

export function normalizeStoredFavorites(value: unknown): FavoriteItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(isFavoriteItem).filter((item) => {
    const key = `${item.type}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseStoredFavorites(raw: string | null): FavoriteItem[] {
  if (!raw) return [];
  try {
    return normalizeStoredFavorites(JSON.parse(raw));
  } catch {
    return [];
  }
}

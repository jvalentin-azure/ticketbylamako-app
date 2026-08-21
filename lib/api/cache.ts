import AsyncStorage from "@react-native-async-storage/async-storage";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface CachedValue<T> {
  data: T;
  ageMs: number;
  isStale: boolean;
}

const CACHE_PREFIX = "api_cache_";
const memoryCache: Record<string, CacheEntry<any>> = {};

/**
 * Get cached data from memory first, then AsyncStorage.
 * Returns null if cache is expired or not found.
 */
export async function getCached<T>(
  key: string,
  maxAgeMs: number,
): Promise<T | null> {
  const cached = await getCachedValue<T>(key, maxAgeMs);
  return cached && !cached.isStale ? cached.data : null;
}

/**
 * Read a cache entry with its freshness metadata. Stale entries are useful as
 * a last-known-good fallback when WordPress is temporarily slow or offline.
 */
export async function getCachedValue<T>(
  key: string,
  maxAgeMs: number,
): Promise<CachedValue<T> | null> {
  const fullKey = CACHE_PREFIX + key;

  // Check memory cache first (fastest)
  const memEntry = memoryCache[fullKey];
  if (memEntry) {
    const ageMs = Date.now() - memEntry.timestamp;
    return { data: memEntry.data as T, ageMs, isStale: ageMs >= maxAgeMs };
  }

  // Check AsyncStorage (persists across app restarts)
  try {
    const stored = await AsyncStorage.getItem(fullKey);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);
      const ageMs = Date.now() - entry.timestamp;
      memoryCache[fullKey] = entry;
      return { data: entry.data, ageMs, isStale: ageMs >= maxAgeMs };
    }
  } catch {
    // Cache miss - not critical
  }

  return null;
}

/**
 * Store data in both memory and AsyncStorage cache.
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
  const fullKey = CACHE_PREFIX + key;
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };

  // Always set memory cache
  memoryCache[fullKey] = entry;

  // Persist to AsyncStorage (fire and forget)
  try {
    await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable - not critical
  }
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const fullKey = CACHE_PREFIX + key;
  delete memoryCache[fullKey];
  try {
    await AsyncStorage.removeItem(fullKey);
  } catch {
    // Not critical
  }
}

/**
 * Invalidate all API caches.
 */
export async function invalidateAllCaches(): Promise<void> {
  // Clear memory cache
  Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);

  // Clear AsyncStorage caches
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {
    // Not critical
  }
}

// Cache duration constants (in milliseconds)
export const CACHE_DURATIONS = {
  EVENTS: 5 * 60 * 1000, // 5 minutes for events list
  CATEGORIES: 30 * 60 * 1000, // 30 minutes for categories
  EVENT_DETAIL: 3 * 60 * 1000, // 3 minutes for single event
  PRODUCTS: 5 * 60 * 1000, // 5 minutes for products
  TICKETS: 10 * 60 * 1000, // 10 minutes for non-sensitive ticket summaries
} as const;

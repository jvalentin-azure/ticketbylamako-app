import { beforeEach, describe, expect, it, vi } from "vitest";

const { storage, mobileV2FetchMock } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  mobileV2FetchMock: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    getAllKeys: vi.fn(async () => [...storage.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => storage.delete(key));
    }),
  },
}));

vi.mock("@/lib/api/mobile", () => ({
  SITE_URL: "https://example.test",
  mobileV2Fetch: mobileV2FetchMock,
}));

import { getCachedValue, invalidateCache, setCache } from "@/lib/api/cache";
import { getHomeData } from "@/lib/api/catalog";

const publishEvent = {
  id: 10,
  date: "2026-09-15T10:00:00",
  status: "publish",
  title: { rendered: "Concert public" },
  content: { rendered: "" },
  minPrice: 0,
  maxPrice: 0,
};

beforeEach(async () => {
  mobileV2FetchMock.mockReset();
  storage.clear();
  await Promise.all([
    invalidateCache("home-data"),
    invalidateCache("events-data"),
    invalidateCache("shop-data"),
    invalidateCache("cache-test"),
  ]);
});

describe("catalogue cache-first", () => {
  it("returns persisted data with freshness metadata", async () => {
    await setCache("cache-test", { value: 42 });

    const cached = await getCachedValue<{ value: number }>(
      "cache-test",
      60_000,
    );

    expect(cached?.data.value).toBe(42);
    expect(cached?.isStale).toBe(false);
  });

  it("discards a structurally invalid persisted cache entry", async () => {
    storage.set(
      "api_cache_cache-test",
      JSON.stringify({ data: { value: 42 }, timestamp: "invalid" }),
    );

    const cached = await getCachedValue<{ value: number }>(
      "cache-test",
      60_000,
    );

    expect(cached).toBeNull();
    expect(storage.has("api_cache_cache-test")).toBe(false);
  });

  it("filters non-public events and preserves a zero price", async () => {
    mobileV2FetchMock.mockResolvedValueOnce({
      events: [
        publishEvent,
        {
          ...publishEvent,
          id: 11,
          status: "private",
          title: { rendered: "QA privé" },
        },
        {
          ...publishEvent,
          id: 12,
          status: undefined,
          title: { rendered: "Statut absent" },
        },
      ],
      products: [],
      categories: [],
    });

    const result = await getHomeData({ forceRefresh: true });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe(10);
    expect(result.events[0].minPrice).toBe(0);
  });

  it("uses the last-known-good catalogue when WordPress is unavailable", async () => {
    mobileV2FetchMock.mockResolvedValueOnce({
      events: [publishEvent],
      products: [],
      categories: [],
    });
    const initial = await getHomeData({ forceRefresh: true });

    mobileV2FetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    const fallback = await getHomeData({ forceRefresh: true });

    expect(fallback.events).toEqual(initial.events);
    expect(fallback.cacheStatus).toBe("stale");
  });
});

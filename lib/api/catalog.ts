/**
 * Native catalog data facade backed only by lamako-mobile/v2 public read routes.
 * Keep this module free of WooCommerce REST credentials and legacy client imports.
 */
import { mobileV2Fetch, SITE_URL } from "./mobile";
import {
  CACHE_DURATIONS,
  getCachedValue,
  invalidateCache,
  setCache,
} from "./cache";
import type {
  EventCategory,
  CatalogImageVariants,
  MobileFields,
  TCEvent,
  TicketType,
  WCCategory,
  WCProduct,
} from "@/lib/types/commerce";
import { normalizeRewardsEnabled } from "@/lib/rewards-eligibility";
import { getEventEndDateValue, getEventStartDateValue } from "@/lib/event-date";

export { SITE_URL };

export type {
  CatalogImageVariants,
  EventCategory,
  MobileFields,
  TCEvent,
  TicketType,
  WCCategory,
  WCProduct,
};

function normalizeCatalogImageVariants(
  raw: any,
): CatalogImageVariants | undefined {
  const webp = typeof raw?.webp === "string" ? raw.webp.trim() : "";
  const avif = typeof raw?.avif === "string" ? raw.avif.trim() : "";
  if (!webp && !avif) return undefined;

  return {
    width: Number(raw?.width || 0) || undefined,
    height: Number(raw?.height || 0) || undefined,
    webp: webp || undefined,
    avif: avif || undefined,
  };
}

interface HomeDataResponse {
  events: TCEvent[];
  products: WCProduct[];
  categories: EventCategory[];
  version?: string;
  generatedAt?: string;
  cacheStatus?: "fresh" | "stale";
}

interface EventsDataResponse {
  events: TCEvent[];
  categories: EventCategory[];
  version?: string;
  generatedAt?: string;
  cacheStatus?: "fresh" | "stale";
}

interface ShopDataResponse {
  products: WCProduct[];
  categories: WCCategory[];
  cacheStatus?: "fresh" | "stale";
}

export interface CatalogRequestOptions {
  forceRefresh?: boolean;
}

type CatalogSnapshotScope = "home" | "events" | "shop";

async function fetchCatalogSnapshot<T>(
  scope: CatalogSnapshotScope,
  forceRefresh = false,
): Promise<T> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), 2500)
    : null;
  const url = new URL(`${SITE_URL}/lamako-catalog/index.php`);
  url.searchParams.set("scope", scope);
  if (forceRefresh) url.searchParams.set("refresh", String(Date.now()));

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`Catalog snapshot unavailable: ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Catalog snapshot is malformed");
    }
    return data as T;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchCatalogWithFallback<T>(
  scope: CatalogSnapshotScope,
  fallback: () => Promise<T>,
  forceRefresh = false,
): Promise<T> {
  try {
    return await fetchCatalogSnapshot<T>(scope, forceRefresh);
  } catch {
    return fallback();
  }
}

const catalogRequests = new Map<string, Promise<unknown>>();

function shareCatalogRequest<T>(
  key: string,
  request: () => Promise<T>,
): Promise<T> {
  const existing = catalogRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = request().finally(() => {
    if (catalogRequests.get(key) === pending) catalogRequests.delete(key);
  });
  catalogRequests.set(key, pending);
  return pending;
}

function refreshInBackground(request: Promise<unknown>): void {
  void request.catch(() => undefined);
}

function normalizeTicket(raw: any, eventId: number | string): TicketType {
  return {
    id: Number(raw?.id || 0),
    name: String(raw?.name || ""),
    price: String(raw?.price || "0"),
    stock_status: raw?.stock_status || "instock",
    usesSeating: Boolean(raw?.usesSeating),
    eventId: String(raw?.eventId || eventId),
    hasCheckoutFields: Boolean(raw?.hasCheckoutFields),
    requiresCheckoutFields: Boolean(raw?.requiresCheckoutFields),
    lamakoRewardsEnabled: normalizeRewardsEnabled(raw, false),
    purchasable: raw?.purchasable !== false && raw?.salesClosed !== true,
    salesClosed: Boolean(raw?.salesClosed),
    ticketingStatus: raw?.ticketingStatus || "available",
    ticketingMessage: raw?.ticketingMessage || "",
  };
}

function normalizeEventMobileFields(raw: any): MobileFields | undefined {
  const fields = raw?.mobileFields || raw?.lamako_mobile || {};
  const eventStart = getEventStartDateValue(raw || {});
  const eventEnd = getEventEndDateValue(raw || {});
  if (!eventStart && !eventEnd && Object.keys(fields).length === 0) {
    return undefined;
  }

  return {
    ...fields,
    event_date_time: eventStart,
    event_end_date_time: eventEnd,
  } as MobileFields;
}

function normalizeEvent(raw: any): TCEvent {
  const eventId = Number(raw?.id || 0);
  return {
    id: eventId,
    date: raw?.date || "",
    slug: raw?.slug || "",
    status: raw?.status || "",
    title: raw?.title || { rendered: "" },
    content: raw?.content || { rendered: "" },
    featured_media: raw?.featured_media || 0,
    event_category: raw?.event_category || [],
    link: raw?.link || "",
    featuredImage: raw?.featuredImage || undefined,
    featuredImageVariants: normalizeCatalogImageVariants(
      raw?.featuredImageVariants,
    ),
    categoryNames: raw?.categoryNames || [],
    mobileFields: normalizeEventMobileFields(raw),
    tickets: (raw?.tickets || []).map((ticket: any) =>
      normalizeTicket(ticket, eventId),
    ),
    minPrice: raw?.minPrice ?? undefined,
    maxPrice: raw?.maxPrice ?? undefined,
    hasSeatingChart: Boolean(raw?.hasSeatingChart),
    lamakoRewardsEnabled: normalizeRewardsEnabled(raw, false),
    isPastEvent: Boolean(raw?.isPastEvent),
    salesClosed: Boolean(raw?.salesClosed),
    ticketingStatus: raw?.ticketingStatus || "available",
    ticketingMessage: raw?.ticketingMessage || "",
  };
}

function isPublicCatalogEvent(event: TCEvent): boolean {
  return (
    event.id > 0 &&
    event.status === "publish" &&
    Boolean(event.title?.rendered?.trim())
  );
}

async function readCatalogCache<T>(
  key: string,
  maxAgeMs: number,
  forceRefresh: boolean,
): Promise<{ fresh: T | null; fallback: T | null }> {
  const cached = await getCachedValue<T>(key, maxAgeMs);
  if (!cached) return { fresh: null, fallback: null };
  return {
    fresh: !forceRefresh && !cached.isStale ? cached.data : null,
    fallback: cached.data,
  };
}

function normalizeProduct(raw: any): WCProduct {
  return {
    id: Number(raw?.id || 0),
    name: String(raw?.name || ""),
    slug: String(raw?.slug || ""),
    permalink: String(raw?.permalink || ""),
    price: String(raw?.price || "0"),
    regular_price: String(raw?.regular_price || ""),
    sale_price: String(raw?.sale_price || ""),
    description: String(raw?.description || ""),
    short_description: String(raw?.short_description || ""),
    images: (raw?.images || []).map((image: any) => ({
      id: Number(image?.id || 0),
      src: String(image?.src || ""),
      alt: String(image?.alt || ""),
      variants: normalizeCatalogImageVariants(image?.variants),
    })),
    categories: (raw?.categories || [])
      .filter(Boolean)
      .map((category: any) => ({
        id: Number(category?.id || 0),
        name: String(category?.name || ""),
        slug: String(category?.slug || ""),
      })),
    stock_status: raw?.stock_status || "instock",
    type: raw?.type || "simple",
    meta_data: [],
    date_created: raw?.date_created || "",
    lamakoRewardsEnabled: normalizeRewardsEnabled(raw, true),
    ...(raw?.lamako_mobile ? { lamako_mobile: raw.lamako_mobile } : {}),
  } as WCProduct;
}

function normalizeShopCategory(raw: any): WCCategory {
  return {
    id: Number(raw?.id || 0),
    name: String(raw?.name || ""),
    slug: String(raw?.slug || ""),
    count: Number(raw?.count || 0),
    image: raw?.image || null,
    parent: Number(raw?.parent || 0),
  };
}

function normalizeEventCategory(raw: any): EventCategory {
  return {
    id: Number(raw?.id || 0),
    name: String(raw?.name || ""),
    slug: String(raw?.slug || ""),
    count: Number(raw?.count || 0),
    parent: Number(raw?.parent || 0),
  };
}

function isBoutiqueCategory(category: WCCategory): boolean {
  return (
    category.slug.startsWith("boutique-") ||
    category.parent === 123 ||
    category.parent === 124 ||
    category.parent === 125 ||
    category.parent === 126 ||
    category.parent === 127
  );
}

export function invalidateCatalogCache(key?: string): void {
  if (key) {
    void invalidateCache(key);
    return;
  }
  ["home-data", "events-data", "shop-data"].forEach((cacheKey) => {
    void invalidateCache(cacheKey);
  });
}

export async function getHomeData(
  options: CatalogRequestOptions = {},
): Promise<HomeDataResponse> {
  const cache = await readCatalogCache<HomeDataResponse>(
    "home-data",
    CACHE_DURATIONS.EVENTS,
    Boolean(options.forceRefresh),
  );
  if (cache.fresh) return { ...cache.fresh, cacheStatus: "fresh" };

  const refresh = () =>
    shareCatalogRequest("home-data", async () => {
      const raw = await fetchCatalogWithFallback<any>(
        "home",
        () =>
          mobileV2Fetch<any>("public/home-data", {
            requireAuth: false,
            params: { summary: true, events_limit: 12, products_limit: 8 },
          }),
        Boolean(options.forceRefresh),
      );
      const result: HomeDataResponse = {
        events: (raw?.events || [])
          .map(normalizeEvent)
          .filter(isPublicCatalogEvent),
        products: (raw?.products || []).map(normalizeProduct),
        categories: (raw?.categories || []).map(normalizeEventCategory),
        version: raw?.version,
        generatedAt: raw?.generatedAt,
        cacheStatus: "fresh",
      };
      await setCache("home-data", result);
      return result;
    });

  if (cache.fallback && !options.forceRefresh) {
    refreshInBackground(refresh());
    return { ...cache.fallback, cacheStatus: "stale" };
  }

  try {
    return await refresh();
  } catch (error) {
    if (cache.fallback) return { ...cache.fallback, cacheStatus: "stale" };
    throw error;
  }
}

export async function getEventsData(
  options: CatalogRequestOptions = {},
): Promise<EventsDataResponse> {
  const cache = await readCatalogCache<EventsDataResponse>(
    "events-data",
    CACHE_DURATIONS.EVENTS,
    Boolean(options.forceRefresh),
  );
  if (cache.fresh) return { ...cache.fresh, cacheStatus: "fresh" };

  const refresh = () =>
    shareCatalogRequest("events-data", async () => {
      const raw = await fetchCatalogWithFallback<any>(
        "events",
        () =>
          mobileV2Fetch<any>("public/events-data", {
            requireAuth: false,
            params: { summary: true, limit: 80 },
          }),
        Boolean(options.forceRefresh),
      );
      const result: EventsDataResponse = {
        events: (raw?.events || [])
          .map(normalizeEvent)
          .filter(isPublicCatalogEvent),
        categories: (raw?.categories || []).map(normalizeEventCategory),
        version: raw?.version,
        generatedAt: raw?.generatedAt,
        cacheStatus: "fresh",
      };
      await setCache("events-data", result);
      return result;
    });

  if (cache.fallback && !options.forceRefresh) {
    refreshInBackground(refresh());
    return { ...cache.fallback, cacheStatus: "stale" };
  }

  try {
    return await refresh();
  } catch (error) {
    if (cache.fallback) return { ...cache.fallback, cacheStatus: "stale" };
    throw error;
  }
}

export async function getShopData(
  options: CatalogRequestOptions = {},
): Promise<ShopDataResponse> {
  const cache = await readCatalogCache<ShopDataResponse>(
    "shop-data",
    CACHE_DURATIONS.PRODUCTS,
    Boolean(options.forceRefresh),
  );
  if (cache.fresh) return { ...cache.fresh, cacheStatus: "fresh" };

  const refresh = () =>
    shareCatalogRequest("shop-data", async () => {
      const raw = await fetchCatalogWithFallback<any>(
        "shop",
        () =>
          mobileV2Fetch<any>("public/shop-data", {
            requireAuth: false,
          }),
        Boolean(options.forceRefresh),
      );
      const result: ShopDataResponse = {
        products: (raw?.products || []).map(normalizeProduct),
        categories: (raw?.categories || []).map(normalizeShopCategory),
        cacheStatus: "fresh",
      };
      await setCache("shop-data", result);
      return result;
    });

  if (cache.fallback && !options.forceRefresh) {
    refreshInBackground(refresh());
    return { ...cache.fallback, cacheStatus: "stale" };
  }

  try {
    return await refresh();
  } catch (error) {
    if (cache.fallback) return { ...cache.fallback, cacheStatus: "stale" };
    throw error;
  }
}

export async function getProduct(
  id: number,
  options: CatalogRequestOptions = {},
): Promise<WCProduct> {
  const cacheKey = `product-${id}`;
  const cache = await readCatalogCache<WCProduct>(
    cacheKey,
    CACHE_DURATIONS.PRODUCTS,
    Boolean(options.forceRefresh),
  );
  if (cache.fresh) return cache.fresh;

  const refresh = () =>
    shareCatalogRequest(cacheKey, async () => {
      const product = normalizeProduct(
        await mobileV2Fetch<any>(`public/products/${id}`, {
          requireAuth: false,
        }),
      );
      await setCache(cacheKey, product);
      return product;
    });

  if (cache.fallback && !options.forceRefresh) {
    refreshInBackground(refresh());
    return cache.fallback;
  }

  try {
    return await refresh();
  } catch (error) {
    if (cache.fallback) return cache.fallback;
    throw error;
  }
}

export async function getTCEvent(id: number): Promise<TCEvent> {
  const cacheKey = `event-${id}`;
  const cached = await getCachedValue<TCEvent>(
    cacheKey,
    CACHE_DURATIONS.EVENT_DETAIL,
  );
  if (cached && !cached.isStale) return cached.data;

  const refresh = shareCatalogRequest(cacheKey, async () => {
    const event = normalizeEvent(
      await mobileV2Fetch<any>(`public/events/${id}`, { requireAuth: false }),
    );
    await setCache(cacheKey, event);
    return event;
  });

  if (cached) {
    refreshInBackground(refresh);
    return cached.data;
  }

  try {
    return await refresh;
  } catch (error) {
    throw error;
  }
}

export async function getEventTickets(eventId: number): Promise<TicketType[]> {
  return (await getTCEvent(eventId)).tickets || [];
}

export async function getShopProducts(
  _params: Record<string, string> = {},
): Promise<WCProduct[]> {
  void _params;
  return (await getShopData()).products;
}

export async function getShopCategories(): Promise<WCCategory[]> {
  return (await getShopData()).categories.filter(isBoutiqueCategory);
}

export async function clearServerCart(
  orderId?: number,
  chartId?: string,
): Promise<void> {
  void orderId;
  void chartId;
}

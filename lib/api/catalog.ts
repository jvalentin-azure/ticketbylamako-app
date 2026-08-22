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
  MobileFields,
  TCEvent,
  TicketType,
  WCCategory,
  WCProduct,
} from "@/lib/types/commerce";
import { normalizeRewardsEnabled } from "@/lib/rewards-eligibility";

export { SITE_URL };

export type {
  EventCategory,
  MobileFields,
  TCEvent,
  TicketType,
  WCCategory,
  WCProduct,
};

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
    categoryNames: raw?.categoryNames || [],
    mobileFields: raw?.mobileFields || undefined,
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

  try {
    const raw = await mobileV2Fetch<any>("public/home-data", {
      requireAuth: false,
      params: { summary: true, events_limit: 12, products_limit: 8 },
    });
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

  try {
    const raw = await mobileV2Fetch<any>("public/events-data", {
      requireAuth: false,
      params: { summary: true, limit: 80 },
    });
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

  try {
    const raw = await mobileV2Fetch<any>("public/shop-data", {
      requireAuth: false,
    });
    const result: ShopDataResponse = {
      products: (raw?.products || []).map(normalizeProduct),
      categories: (raw?.categories || []).map(normalizeShopCategory),
      cacheStatus: "fresh",
    };
    await setCache("shop-data", result);
    return result;
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

  try {
    const product = normalizeProduct(
      await mobileV2Fetch<any>(`public/products/${id}`, { requireAuth: false }),
    );
    await setCache(cacheKey, product);
    return product;
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

  try {
    const event = normalizeEvent(
      await mobileV2Fetch<any>(`public/events/${id}`, { requireAuth: false }),
    );
    await setCache(cacheKey, event);
    return event;
  } catch (error) {
    if (cached) return cached.data;
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

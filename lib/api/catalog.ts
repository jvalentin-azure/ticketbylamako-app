/**
 * Native catalog data facade backed only by lamako-mobile/v2 public read routes.
 * Keep this module free of WooCommerce REST credentials and legacy client imports.
 */
import { mobileV2Fetch, SITE_URL } from "./mobile";
import type {
  EventCategory,
  MobileFields,
  TCEvent,
  TicketType,
  WCCategory,
  WCProduct,
} from "@/lib/types/commerce";

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
}

interface EventsDataResponse {
  events: TCEvent[];
  categories: EventCategory[];
  version?: string;
  generatedAt?: string;
}

interface ShopDataResponse {
  products: WCProduct[];
  categories: WCCategory[];
}

const memoryCache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 300000;

function getCached<T>(key: string): T | null {
  const entry = memoryCache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  memoryCache[key] = { data, timestamp: Date.now() };
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
    lamakoRewardsEnabled: raw?.lamakoRewardsEnabled !== false,
  };
}

function normalizeEvent(raw: any): TCEvent {
  const eventId = Number(raw?.id || 0);
  return {
    id: eventId,
    date: raw?.date || "",
    slug: raw?.slug || "",
    status: raw?.status || "publish",
    title: raw?.title || { rendered: "" },
    content: raw?.content || { rendered: "" },
    featured_media: raw?.featured_media || 0,
    event_category: raw?.event_category || [],
    link: raw?.link || "",
    featuredImage: raw?.featuredImage || undefined,
    categoryNames: raw?.categoryNames || [],
    mobileFields: raw?.mobileFields || undefined,
    tickets: (raw?.tickets || []).map((ticket: any) => normalizeTicket(ticket, eventId)),
    minPrice: raw?.minPrice || undefined,
    maxPrice: raw?.maxPrice || undefined,
    hasSeatingChart: Boolean(raw?.hasSeatingChart),
    lamakoRewardsEnabled: raw?.lamakoRewardsEnabled !== false,
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
    categories: (raw?.categories || []).filter(Boolean).map((category: any) => ({
      id: Number(category?.id || 0),
      name: String(category?.name || ""),
      slug: String(category?.slug || ""),
    })),
    stock_status: raw?.stock_status || "instock",
    type: raw?.type || "simple",
    meta_data: [],
    date_created: raw?.date_created || "",
    lamakoRewardsEnabled: raw?.lamakoRewardsEnabled !== false,
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
    delete memoryCache[key];
    return;
  }
  Object.keys(memoryCache).forEach(cacheKey => delete memoryCache[cacheKey]);
}

export async function getHomeData(): Promise<HomeDataResponse> {
  const cached = getCached<HomeDataResponse>("home-data");
  if (cached) return cached;

  const raw = await mobileV2Fetch<any>("public/home-data", {
    requireAuth: false,
    params: { summary: true, events_limit: 12, products_limit: 8 },
  });
  const result: HomeDataResponse = {
    events: (raw?.events || []).map(normalizeEvent),
    products: (raw?.products || []).map(normalizeProduct),
    categories: (raw?.categories || []).map(normalizeEventCategory),
    version: raw?.version,
    generatedAt: raw?.generatedAt,
  };
  setCache("home-data", result);
  return result;
}

export async function getEventsData(): Promise<EventsDataResponse> {
  const cached = getCached<EventsDataResponse>("events-data");
  if (cached) return cached;

  const raw = await mobileV2Fetch<any>("public/events-data", {
    requireAuth: false,
    params: { summary: true, limit: 80 },
  });
  const result: EventsDataResponse = {
    events: (raw?.events || []).map(normalizeEvent),
    categories: (raw?.categories || []).map(normalizeEventCategory),
    version: raw?.version,
    generatedAt: raw?.generatedAt,
  };
  setCache("events-data", result);
  return result;
}

export async function getShopData(): Promise<ShopDataResponse> {
  const cached = getCached<ShopDataResponse>("shop-data");
  if (cached) return cached;

  const raw = await mobileV2Fetch<any>("public/shop-data", { requireAuth: false });
  const result: ShopDataResponse = {
    products: (raw?.products || []).map(normalizeProduct),
    categories: (raw?.categories || []).map(normalizeShopCategory),
  };
  setCache("shop-data", result);
  return result;
}

export async function getProduct(id: number): Promise<WCProduct> {
  return normalizeProduct(await mobileV2Fetch<any>(`public/products/${id}`, { requireAuth: false }));
}

export async function getTCEvent(id: number): Promise<TCEvent> {
  const cached = getCached<TCEvent>(`event-${id}`);
  if (cached) return cached;

  const event = normalizeEvent(await mobileV2Fetch<any>(`public/events/${id}`, { requireAuth: false }));
  setCache(`event-${id}`, event);
  return event;
}

export async function getEventTickets(eventId: number): Promise<TicketType[]> {
  return (await getTCEvent(eventId)).tickets || [];
}

export async function getShopProducts(_params: Record<string, string> = {}): Promise<WCProduct[]> {
  void _params;
  return (await getShopData()).products;
}

export async function getShopCategories(): Promise<WCCategory[]> {
  return (await getShopData()).categories.filter(isBoutiqueCategory);
}

export async function clearServerCart(orderId?: number, chartId?: string): Promise<void> {
  void orderId;
  void chartId;
}

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const CK = process.env.EXPO_PUBLIC_WC_CONSUMER_KEY || "";
const CS = process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET || "";

function wcUrl(endpoint: string, params: Record<string, string> = {}): string {
  const url = new URL(`${SITE_URL}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("consumer_key", CK);
  url.searchParams.set("consumer_secret", CS);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

function wpUrl(endpoint: string, params: Record<string, string> = {}): string {
  const url = new URL(`${SITE_URL}/wp-json/wp/v2/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function wcFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(wcUrl(endpoint, params));
  if (!res.ok) throw new Error(`WC API error: ${res.status}`);
  return res.json();
}

async function wpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(wpUrl(endpoint, params));
  if (!res.ok) throw new Error(`WP API error: ${res.status}`);
  return res.json();
}

// ---- Types ----

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  images: { id: number; src: string; alt: string }[];
  categories: { id: number; name: string; slug: string }[];
  stock_status: string;
  type: string;
  meta_data: { key: string; value: any }[];
  date_created: string;
  variations?: number[];
  attributes?: { id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }[];
}

export interface WCOrder {
  id: number;
  status: string;
  total: string;
  currency: string;
  date_created: string;
  billing: { first_name: string; last_name: string; email: string; phone: string };
  line_items: { id: number; name: string; quantity: number; total: string; product_id: number; meta_data: { key: string; value: any }[] }[];
  meta_data: { key: string; value: any }[];
}

export interface WCCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  image: { src: string } | null;
  parent: number;
}

/**
 * Tickera Event (from wp/v2/tc_events endpoint).
 * Events are WordPress custom post type, NOT WooCommerce products.
 * Ticket products (WC products) link to events via _event_name meta.
 */
export interface TCEvent {
  id: number;
  date: string;
  slug: string;
  status: string;
  title: { rendered: string };
  content: { rendered: string };
  featured_media: number;
  event_category: number[];
  link: string;
  // Populated from _embed
  featuredImage?: string;
  categoryNames?: string[];
  // Computed from ticket products
  tickets?: TicketType[];
  minPrice?: number;
  maxPrice?: number;
  hasSeatingChart?: boolean;
}

export interface TicketType {
  id: number;
  name: string;
  price: string;
  stock_status: string;
  usesSeating: boolean;
  eventId: string;
}

export interface EventCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

// ---- API Functions ----

export async function getProducts(params: Record<string, string> = {}): Promise<WCProduct[]> {
  return wcFetch<WCProduct[]>("products", { per_page: "20", ...params });
}

export async function getProduct(id: number): Promise<WCProduct> {
  return wcFetch<WCProduct>(`products/${id}`);
}

export async function getCategories(): Promise<WCCategory[]> {
  return wcFetch<WCCategory[]>("products/categories", { per_page: "100" });
}

export async function getOrders(token: string, params: Record<string, string> = {}): Promise<WCOrder[]> {
  const url = wcUrl("orders", { per_page: "20", ...params });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Orders API error: ${res.status}`);
  return res.json();
}

export async function getOrder(id: number): Promise<WCOrder> {
  return wcFetch<WCOrder>(`orders/${id}`);
}

export async function getCustomerOrders(customerId: number): Promise<WCOrder[]> {
  return wcFetch<WCOrder[]>("orders", { customer: String(customerId), per_page: "50" });
}

export async function getAllOrders(params: Record<string, string> = {}): Promise<WCOrder[]> {
  return wcFetch<WCOrder[]>("orders", { per_page: "50", ...params });
}

export async function getCustomers(params: Record<string, string> = {}): Promise<any[]> {
  return wcFetch<any[]>("customers", { per_page: "50", ...params });
}

export async function getReports(): Promise<any> {
  return wcFetch<any>("reports/sales", { period: "month" });
}

// ---- Tickera Events (wp/v2/tc_events) ----

/**
 * Fetch events from the Tickera custom post type endpoint.
 * Uses _embed to get featured images and categories in one request.
 */
export async function getTCEvents(params: Record<string, string> = {}): Promise<TCEvent[]> {
  const raw = await wpFetch<any[]>("tc_events", { per_page: "50", _embed: "", status: "publish", ...params });
  return raw.map(e => ({
    id: e.id,
    date: e.date,
    slug: e.slug,
    status: e.status,
    title: e.title,
    content: e.content,
    featured_media: e.featured_media,
    event_category: e.event_category || [],
    link: e.link,
    featuredImage: e._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
    categoryNames: e._embedded?.["wp:term"]?.flat()?.map((t: any) => t.name) || [],
  }));
}

/**
 * Fetch a single Tickera event by ID.
 */
export async function getTCEvent(id: number): Promise<TCEvent> {
  const raw = await wpFetch<any>(`tc_events/${id}`, { _embed: "" });
  return {
    id: raw.id,
    date: raw.date,
    slug: raw.slug,
    status: raw.status,
    title: raw.title,
    content: raw.content,
    featured_media: raw.featured_media,
    event_category: raw.event_category || [],
    link: raw.link,
    featuredImage: raw._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
    categoryNames: raw._embedded?.["wp:term"]?.flat()?.map((t: any) => t.name) || [],
  };
}

/**
 * Fetch event categories (Tickera taxonomy).
 */
export async function getEventCategories(): Promise<EventCategory[]> {
  return wpFetch<EventCategory[]>("event_category", { per_page: "50" });
}

/**
 * Get ticket products for a specific event.
 * Ticket products are WC products with _tc_is_ticket='yes' and _event_name=eventId.
 */
export async function getEventTickets(eventId: number): Promise<TicketType[]> {
  const products = await getProducts({ per_page: "100" });
  return products
    .filter(p => {
      const isTicket = p.meta_data?.some(m => m.key === "_tc_is_ticket" && m.value === "yes");
      const eventName = p.meta_data?.find(m => m.key === "_event_name")?.value;
      return isTicket && String(eventName) === String(eventId);
    })
    .map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock_status: p.stock_status,
      usesSeating: p.meta_data?.find(m => m.key === "_tc_used_for_seatings")?.value === "yes",
      eventId: String(eventId),
    }));
}

/**
 * Get all events with their ticket info (prices, seating).
 * This combines tc_events with their WC ticket products.
 */
export async function getEventsWithTickets(): Promise<TCEvent[]> {
  const [events, products] = await Promise.all([
    getTCEvents(),
    getProducts({ per_page: "100" }),
  ]);

  // Build a map of eventId -> ticket products
  const ticketMap: Record<string, TicketType[]> = {};
  products.forEach(p => {
    const isTicket = p.meta_data?.some(m => m.key === "_tc_is_ticket" && m.value === "yes");
    if (!isTicket) return;
    const eventId = p.meta_data?.find(m => m.key === "_event_name")?.value;
    if (!eventId) return;
    const key = String(eventId);
    if (!ticketMap[key]) ticketMap[key] = [];
    ticketMap[key].push({
      id: p.id,
      name: p.name,
      price: p.price,
      stock_status: p.stock_status,
      usesSeating: p.meta_data?.find(m => m.key === "_tc_used_for_seatings")?.value === "yes",
      eventId: key,
    });
  });

  return events.map(e => {
    const tickets = ticketMap[String(e.id)] || [];
    const prices = tickets.map(t => parseFloat(t.price) || 0).filter(p => p > 0);
    return {
      ...e,
      tickets,
      minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
      maxPrice: prices.length > 0 ? Math.max(...prices) : undefined,
      hasSeatingChart: tickets.some(t => t.usesSeating),
    };
  });
}

// ---- Shop Products (non-ticket WC products) ----

/**
 * Check if a WC product is a Tickera ticket (not a shop product).
 */
export function isTicketProduct(product: WCProduct): boolean {
  return product.meta_data?.some(m => m.key === "_tc_is_ticket" && m.value === "yes") || false;
}

/**
 * Get shop products only (excludes ticket products).
 * Shop products are in Boutique categories or any product without _tc_is_ticket.
 */
export async function getShopProducts(params: Record<string, string> = {}): Promise<WCProduct[]> {
  const products = await getProducts({ per_page: "50", ...params });
  return products.filter(p => !isTicketProduct(p));
}

/**
 * Get shop categories (Boutique – Goodies, Boutique – Livres, etc.)
 */
export async function getShopCategories(): Promise<WCCategory[]> {
  const cats = await getCategories();
  return cats.filter(c =>
    c.slug.startsWith("boutique-") ||
    c.parent === 123 || // Goodies children
    c.parent === 124 || // Livres children
    c.parent === 125 || // Affiches children
    c.parent === 126 || // Packs children
    c.parent === 127    // Promotions children
  );
}

// ---- Legacy helpers (for backward compatibility) ----

/** @deprecated Use isTicketProduct instead */
export function isTickeraEvent(product: WCProduct): boolean {
  return isTicketProduct(product);
}

/** @deprecated Use TCEvent fields directly */
export function getEventMeta(product: WCProduct, key: string): any {
  return product.meta_data?.find(m => m.key === key)?.value;
}

/** @deprecated Use getTCEvents or getEventsWithTickets instead */
export async function getEvents(params: Record<string, string> = {}): Promise<WCProduct[]> {
  // Fallback: return ticket products grouped by event (old behavior)
  const products = await getProducts({ per_page: "100", ...params });
  return products.filter(isTicketProduct);
}

export { SITE_URL };

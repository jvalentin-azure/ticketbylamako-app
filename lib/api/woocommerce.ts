export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
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

function mobileApiUrl(endpoint: string, params: Record<string, string> = {}): string {
  const url = new URL(`${SITE_URL}/wp-json/lamako-mobile/v1/${endpoint}`);
  url.searchParams.set("consumer_key", CK);
  url.searchParams.set("consumer_secret", CS);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function mobileApiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(mobileApiUrl(endpoint, params));
  if (!res.ok) throw new Error(`Mobile API error: ${res.status}`);
  return res.json();
}

async function mobileApiPost<T>(endpoint: string, body: any): Promise<T> {
  const url = mobileApiUrl(endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Mobile API POST error: ${res.status} ${errText}`);
  }
  return res.json();
}

// ---- Clear Server Cart ----
export async function clearServerCart(): Promise<void> {
  try {
    await mobileApiPost<{ success: boolean }>('clear-cart', {});
  } catch (e) {
    // Non-critical - don't throw if cart clear fails
    console.warn('Failed to clear server cart:', e);
  }
}

// ---- Create Order (for checkout) ----

export interface CreateOrderItem {
  product_id: number;
  quantity: number;
  variation_id?: number;
}

export interface CreateOrderBilling {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1?: string;
  city?: string;
  country?: string;
}

export interface CreateOrderResponse {
  order_id: number;
  order_key: string;
  checkout_url: string;
  total: string;
  item_count: number;
  errors: string[];
}

/**
 * Create a pending WC order from app cart items.
 * Returns a "pay for order" URL that works without session cookies.
 */
export async function createOrder(
  items: CreateOrderItem[],
  billing: CreateOrderBilling,
  customerId?: number
): Promise<CreateOrderResponse> {
  return mobileApiPost<CreateOrderResponse>('create-order', {
    items,
    billing,
    customer_id: customerId || 0,
  });
}

// ---- Push Token Registration ----

/**
 * Register an Expo push token with the WordPress backend.
 * This allows the server to send push notifications for order updates, new events, etc.
 */
export async function registerPushToken(
  token: string,
  userId?: number,
  platform?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    return await mobileApiPost<{ success: boolean; message?: string }>('register-push-token', {
      token,
      user_id: userId || 0,
      platform: platform || 'unknown',
    });
  } catch (error) {
    console.warn('Failed to register push token with server:', error);
    return { success: false, message: String(error) };
  }
}

// ---- Ticket Instance Types ----

export interface TicketInstance {
  instance_id: number;
  ticket_code: string;
  product_name: string;
  product_id: number;
  price: number;
  seat_label: string;
  seat_id: string;
  event_id: number;
  event_name: string;
  event_date: string;
  event_location: string;
}

export interface OrderTicketsResponse {
  order_id: number;
  order_status: string;
  order_date: string;
  billing_name: string;
  billing_email: string;
  total: string;
  tickets: TicketInstance[];
}

/**
 * Get ticket instances for a WooCommerce order.
 * Uses the lamako-mobile REST endpoint (requires lamako-mobile-api.php mu-plugin).
 * Falls back to extracting info from tc_cart_info if the endpoint is not available.
 */
export async function getOrderTickets(orderId: number): Promise<OrderTicketsResponse | null> {
  try {
    return await mobileApiFetch<OrderTicketsResponse>(`order-tickets/${orderId}`);
  } catch {
    // Fallback: extract from WC order meta
    return null;
  }
}

/**
 * Extract ticket info from WC order tc_cart_info meta (fallback when mobile API is unavailable).
 * Returns individual ticket entries with seat info.
 */
export function extractTicketsFromOrder(order: WCOrder): TicketInstance[] {
  const tickets: TicketInstance[] = [];
  const cartInfo = order.meta_data?.find(m => m.key === "tc_cart_info")?.value;
  const cartContents = order.meta_data?.find(m => m.key === "tc_cart_contents")?.value;
  
  if (!cartInfo || typeof cartInfo !== "object") {
    // No Tickera data - create basic entries from line items
    order.line_items.forEach(li => {
      for (let i = 0; i < li.quantity; i++) {
        tickets.push({
          instance_id: 0,
          ticket_code: `ORD-${order.id}-${li.id}-${i + 1}`,
          product_name: li.name,
          product_id: li.product_id,
          price: parseFloat(li.total) / li.quantity,
          seat_label: "",
          seat_id: "",
          event_id: 0,
          event_name: "",
          event_date: "",
          event_location: "",
        });
      }
    });
    return tickets;
  }
  
  const ownerData = (cartInfo as any).owner_data;
  if (!ownerData || typeof ownerData !== "object") {
    // Has cart_info but no owner_data
    order.line_items.forEach(li => {
      for (let i = 0; i < li.quantity; i++) {
        tickets.push({
          instance_id: 0,
          ticket_code: `ORD-${order.id}-${li.id}-${i + 1}`,
          product_name: li.name,
          product_id: li.product_id,
          price: parseFloat(li.total) / li.quantity,
          seat_label: "",
          seat_id: "",
          event_id: 0,
          event_name: "",
          event_date: "",
          event_location: "",
        });
      }
    });
    return tickets;
  }
  
  // Extract from owner_data structure
  const seatLabels = ownerData.seat_label_post_meta || {};
  const seatIds = ownerData.seat_id_post_meta || {};
  const ticketTypeIds = ownerData.ticket_type_id_post_meta || {};
  
  order.line_items.forEach(li => {
    const typeId = String(li.product_id);
    const seats = seatLabels[typeId] || [];
    const seatIdList = seatIds[typeId] || [];
    const pricePerTicket = parseFloat(li.total) / li.quantity;
    
    for (let i = 0; i < li.quantity; i++) {
      tickets.push({
        instance_id: 0,
        ticket_code: `ORD-${order.id}-${li.product_id}-${i + 1}`,
        product_name: li.name,
        product_id: li.product_id,
        price: pricePerTicket,
        seat_label: seats[i] || "",
        seat_id: seatIdList[i] || "",
        event_id: 0,
        event_name: "",
        event_date: "",
        event_location: "",
      });
    }
  });
  
  return tickets;
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
  subtotal?: string;
  total_tax?: string;
  discount_total?: string;
  shipping_total?: string;
  currency: string;
  date_created: string;
  date_completed?: string;
  date_paid?: string;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_note?: string;
  billing: { first_name: string; last_name: string; email: string; phone: string; address_1?: string; city?: string; country?: string };
  shipping?: { first_name: string; last_name: string; address_1?: string; city?: string; country?: string };
  line_items: { id: number; name: string; quantity: number; total: string; subtotal?: string; price?: number; product_id: number; sku?: string; meta_data: { key: string; value: any }[] }[];
  meta_data: { key: string; value: any }[];
  number?: string;
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
export interface MobileFields {
  description: string | null;
  gallery: string[] | null;
  practical_info: { label: string; value: string }[] | null;
  event_date_time?: string | null;
  event_end_date_time?: string | null;
  event_location?: string | null;
  event_terms?: string | null;
  event_logo?: string | null;
  sponsors_logo?: string | null;
}

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
  // Mobile-specific fields from lamako-mobile-fields plugin
  mobileFields?: MobileFields;
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
    mobileFields: e.lamako_mobile || undefined,
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
    mobileFields: raw.lamako_mobile || undefined,
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

/**
 * Get the seating chart embed URL for an event.
 * 
 * Strategy:
 * 1. Try the lamako-mobile API endpoint (server-side lookup by event_name meta)
 * 2. Fallback: scrape the event page for data-seating-map-id and build embed URL
 * 
 * The embed URL uses ?lamako_seat_embed=1&chart_id=X which renders a clean page
 * with only the seating chart shortcode (no theme header/footer).
 */
export async function getSeatingChartUrl(eventId: number, eventSlug?: string, eventLink?: string): Promise<string | null> {
  try {
    // Method 1: Use the lamako-mobile API to get the correct chart for this event
    try {
      const apiRes = await fetch(mobileApiUrl(`seat-chart-url/${eventId}`));
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.has_chart && data.embed_url) {
          return data.embed_url;
        }
      }
    } catch {
      // API not available, fall through to scraping
    }
    
    // Method 2: Fallback - scrape the event page for the seating map ID
    const eventUrl = eventLink || `${SITE_URL}/tc-events/${eventSlug || eventId}/`;
    const res = await fetch(eventUrl);
    if (!res.ok) return null;
    const html = await res.text();
    
    // Extract the seating map ID from data-seating-map-id attribute
    const match = html.match(/data-seating-map-id="(\d+)"/);
    if (!match) return null;
    const chartId = match[1];
    
    // Build the clean embed URL using our WordPress plugin's template_redirect handler
    // This renders ONLY the seating chart shortcode without any theme chrome
    return `${SITE_URL}/?lamako_seat_embed=1&chart_id=${chartId}`;
  } catch {
    return null;
  }
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

// SITE_URL is exported at top of file

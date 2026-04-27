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

function wpUrl(endpoint: string): string {
  return `${SITE_URL}/wp-json/wp/v2/${endpoint}`;
}

async function wcFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(wcUrl(endpoint, params));
  if (!res.ok) throw new Error(`WC API error: ${res.status}`);
  return res.json();
}

async function wpFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(wpUrl(endpoint));
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
}

export interface TCEvent {
  id: number;
  name: string;
  slug: string;
  description: string;
  images: { src: string }[];
  categories: { id: number; name: string }[];
  meta_data: { key: string; value: any }[];
  price: string;
  date_created: string;
  // Tickera event meta
  event_date_time?: string;
  event_end_date_time?: string;
  event_location?: string;
  event_logo_file_url?: string;
  event_terms?: string;
  sponsors_logo_file_url?: string;
}

// ---- API Functions ----

export async function getProducts(params: Record<string, string> = {}): Promise<WCProduct[]> {
  return wcFetch<WCProduct[]>("products", { per_page: "20", ...params });
}

export async function getProduct(id: number): Promise<WCProduct> {
  return wcFetch<WCProduct>(`products/${id}`);
}

export async function getCategories(): Promise<WCCategory[]> {
  return wcFetch<WCCategory[]>("products/categories", { per_page: "50" });
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

// ---- Event helpers (Tickera events are WC products with tc_event meta) ----

export function isTickeraEvent(product: WCProduct): boolean {
  return product.meta_data?.some(m => m.key === "event_date_time") || false;
}

export function getEventMeta(product: WCProduct, key: string): any {
  return product.meta_data?.find(m => m.key === key)?.value;
}

export async function getEvents(params: Record<string, string> = {}): Promise<WCProduct[]> {
  const products = await getProducts({ per_page: "100", ...params });
  return products.filter(isTickeraEvent);
}

export async function getShopProducts(params: Record<string, string> = {}): Promise<WCProduct[]> {
  const products = await getProducts({ per_page: "50", ...params });
  return products.filter(p => !isTickeraEvent(p));
}

export { SITE_URL };

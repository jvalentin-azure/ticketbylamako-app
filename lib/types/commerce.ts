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
  attributes?: {
    id: number;
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }[];
  lamakoRewardsEnabled?: boolean;
  lamako_mobile?: {
    description: string | null;
    gallery: string[] | null;
    practical_info: { label: string; value: string }[] | null;
  } | null;
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
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  shipping?: {
    first_name: string;
    last_name: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  line_items: {
    id: number;
    name: string;
    quantity: number;
    total: string;
    subtotal?: string;
    price?: number;
    product_id: number;
    sku?: string;
    meta_data: { key: string; value: any }[];
  }[];
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
  featuredImage?: string;
  categoryNames?: string[];
  mobileFields?: MobileFields;
  tickets?: TicketType[];
  minPrice?: number;
  maxPrice?: number;
  hasSeatingChart?: boolean;
  lamakoRewardsEnabled?: boolean;
  isPastEvent?: boolean;
  salesClosed?: boolean;
  ticketingStatus?: "available" | "ended" | string;
  ticketingMessage?: string;
}

export interface TicketType {
  id: number;
  name: string;
  price: string;
  stock_status: string;
  usesSeating: boolean;
  eventId: string;
  hasCheckoutFields?: boolean;
  requiresCheckoutFields?: boolean;
  lamakoRewardsEnabled?: boolean;
  purchasable?: boolean;
  salesClosed?: boolean;
  ticketingStatus?: "available" | "ended" | string;
  ticketingMessage?: string;
}

export type CheckoutFieldType =
  | "text"
  | "number"
  | "email"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox";
export type CheckoutFieldValue = string | string[];

export interface CheckoutFieldOption {
  label: string;
  value: string;
}

export interface CheckoutFieldSchema {
  key: string;
  storageKey: string;
  label: string;
  type: CheckoutFieldType;
  scope: "buyer" | "attendee";
  required: boolean;
  visible: boolean;
  custom: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: string;
  validation?: string;
  min?: string;
  max?: string;
  step?: string;
  options: CheckoutFieldOption[];
}

export interface EventCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

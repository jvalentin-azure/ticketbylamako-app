export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  isEvent: boolean;
  eventId?: number;
  ticketType?: string;
  seatLabel?: string;
  hasCheckoutFields?: boolean;
  requiresCheckoutFields?: boolean;
  lamakoRewardsEnabled?: boolean;
  purchasable?: boolean;
  salesClosed?: boolean;
  ticketingStatus?: string;
  ticketingMessage?: string;
}

export const CART_HOLD_DURATION_MS = 10 * 60 * 1000;

export function parseCartExpiryTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const timestamp = Number(raw);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function createCartExpiryTimestamp(now = Date.now()): number {
  return now + CART_HOLD_DURATION_MS;
}

export function cartHoldRemainingMs(
  expiresAt: number | null,
  now = Date.now(),
): number {
  return expiresAt ? Math.max(0, expiresAt - now) : 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.productId === "number" &&
    Number.isFinite(item.productId) &&
    item.productId > 0 &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.image === "string" &&
    typeof item.isEvent === "boolean" &&
    (item.eventId === undefined ||
      (typeof item.eventId === "number" && Number.isFinite(item.eventId))) &&
    isOptionalString(item.ticketType) &&
    isOptionalString(item.seatLabel) &&
    isOptionalBoolean(item.hasCheckoutFields) &&
    isOptionalBoolean(item.requiresCheckoutFields) &&
    isOptionalBoolean(item.lamakoRewardsEnabled) &&
    isOptionalBoolean(item.purchasable) &&
    isOptionalBoolean(item.salesClosed) &&
    isOptionalString(item.ticketingStatus) &&
    isOptionalString(item.ticketingMessage)
  );
}

export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(isCartItem);
  } catch {
    return [];
  }
}

export const parseCartActivityTimestamp = parseCartExpiryTimestamp;

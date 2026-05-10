import { getStoredToken } from "./auth";

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
export const MOBILE_V2_SEATING_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_MOBILE_V2_SEATING !== "false";

type QueryValue = string | number | boolean | null | undefined;
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class MobileApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface MobileFetchOptions {
  method?: HttpMethod;
  params?: Record<string, QueryValue>;
  body?: unknown;
  token?: string | null;
  requireAuth?: boolean;
}

function mobileV2Url(endpoint: string, params: Record<string, QueryValue> = {}): string {
  const normalized = endpoint.replace(/^\/+/, "");
  const url = new URL(`${SITE_URL}/wp-json/lamako-mobile/v2/${normalized}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function mobileV2Fetch<T>(
  endpoint: string,
  options: MobileFetchOptions = {}
): Promise<T> {
  const requireAuth = options.requireAuth !== false;
  const token = options.token ?? (requireAuth ? await getStoredToken() : null);

  if (requireAuth && !token) {
    throw new MobileApiError("Authentication required", 401, "not_authenticated");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(mobileV2Url(endpoint, options.params), {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await parseResponse(res);
  if (!res.ok) {
    const body = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const message =
      typeof body.message === "string" ? body.message : `Mobile API error: ${res.status}`;
    const code = typeof body.code === "string" ? body.code : undefined;
    throw new MobileApiError(message, res.status, code, data);
  }

  return data as T;
}

export type CommerceLane = "product" | "ticket";

export interface MobileCheckoutItemInput {
  productId?: number;
  product_id?: number;
  variationId?: number;
  variation_id?: number;
  quantity: number;
  lane?: CommerceLane;
}

interface MobileCheckoutItemPayload {
  product_id: number;
  variation_id?: number;
  quantity: number;
  lane?: CommerceLane;
}

export interface MobileAddressInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address_1?: string;
  city?: string;
  country?: string;
}

export interface CreateMobileCheckoutRequest {
  items: MobileCheckoutItemInput[];
  billing?: MobileAddressInput;
  shipping?: MobileAddressInput;
  couponCode?: string;
  source?: "native_cart" | "product" | "ticket" | string;
}

export interface CreateMobileCheckoutResponse {
  checkoutToken: string;
  checkoutUrl: string;
  orderId: number;
  expiresAt: string;
  total: string;
  currency: string;
  itemCount: number;
}

export interface CreateMobileSeatingSessionRequest {
  eventId: number;
}

export interface CreateMobileSeatingSessionResponse {
  flowId: string;
  flowToken: string;
  eventId: number;
  chartId: number;
  seatUrl: string;
  expiresAt: string;
}

export type MobilePaymentStatus =
  | "success"
  | "pending"
  | "failed"
  | "cancelled"
  | "expired"
  | "unknown";

export interface MobileOrderItem {
  id: number;
  name: string;
  quantity: number;
  productId: number;
  total: string;
  subtotal?: string;
  price?: number;
  sku?: string;
}

export interface MobileOrderSummary {
  id: number;
  number: string;
  status: string;
  paymentStatus: MobilePaymentStatus;
  total: string;
  subtotal?: string;
  totalTax?: string;
  discountTotal?: string;
  shippingTotal?: string;
  currency: string;
  dateCreated: string | null;
  datePaid: string | null;
  paymentMethod: string;
  paymentMethodTitle: string;
  transactionId?: string;
  customerNote?: string;
  ticketsReady: boolean;
  ticketCount: number;
  createdVia: string;
  billing?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  items?: MobileOrderItem[];
}

export interface MobileCheckoutStatusResponse {
  checkoutToken: string;
  order: MobileOrderSummary;
}

export interface MobileSeatingSessionStatusResponse {
  flowId: string;
  eventId: number;
  chartId: number;
  status: MobilePaymentStatus | "active";
  expiresAt: string | null;
  seatUrl: string;
  checkoutUrl: string;
  order: MobileOrderSummary | null;
  ticketsReady: boolean;
}

export interface MobilePaymentReturnStatusResponse {
  kind: "checkout" | "seating";
  token: string;
  status: MobilePaymentStatus | "active";
  order: MobileOrderSummary | null;
  ticketsReady: boolean;
}

export interface MobileOrdersResponse {
  orders: MobileOrderSummary[];
}

export interface MobileTicket {
  instanceId: number;
  ticketCode: string;
  productId: number;
  productName: string;
  orderId: number;
  orderStatus: string;
  eventId: number;
  eventName: string;
  price?: number;
  eventDate?: string;
  eventLocation?: string;
  seatLabel: string;
  seatId: string;
  status: string;
}

export interface MobileOrderTicketsResponse {
  orderId: number;
  orderStatus: string;
  ticketsReady: boolean;
  tickets: MobileTicket[];
}

export interface MobilePushTokenRequest {
  token: string;
  platform?: string;
  deviceId?: string;
}

export interface MobileRewardsBalance {
  userId: number;
  balance: number;
  totalEarned: number;
  tier: string;
  tierName: string;
  nextTier: string;
  pointsToNextTier: number;
  canRedeem: boolean;
}

export interface MobileRewardTransaction {
  id: string;
  type: "earn" | "redeem";
  reference: string;
  orderId?: number;
  amount: number;
  description: string;
  date: string;
}

export interface MobileRewardsHistoryResponse {
  history: MobileRewardTransaction[];
}

export interface MobileRewardsRedeemResponse {
  success: boolean;
  couponCode: string;
  discountValue: number;
  pointsDeducted: number;
  newBalance: number;
  expiresAt: string;
}

export interface MobileReferralCodeResponse {
  code: string;
  referralCount: number;
}

export interface MobileReferralValidateResponse {
  valid: boolean;
  referrerName?: string;
  bonus?: number;
  message?: string;
}

export interface MobileReferralRegisterResponse {
  success: boolean;
  referrerId?: number;
  refereeBonus?: number;
  error?: string;
}

function normalizeCheckoutItems(items: MobileCheckoutItemInput[]): MobileCheckoutItemPayload[] {
  return items.map(item => {
    const productId = item.product_id ?? item.productId ?? 0;
    const variationId = item.variation_id ?? item.variationId;
    return {
      product_id: productId,
      variation_id: variationId || undefined,
      quantity: item.quantity,
      lane: item.lane,
    };
  });
}

export async function createMobileCheckout(
  request: CreateMobileCheckoutRequest
): Promise<CreateMobileCheckoutResponse> {
  return mobileV2Fetch<CreateMobileCheckoutResponse>("checkouts", {
    method: "POST",
    body: {
      ...request,
      items: normalizeCheckoutItems(request.items),
    },
  });
}

export async function getMobileCheckoutStatus(
  checkoutToken: string
): Promise<MobileCheckoutStatusResponse> {
  return mobileV2Fetch<MobileCheckoutStatusResponse>(
    `checkouts/${encodeURIComponent(checkoutToken)}/status`
  );
}

export async function createMobileSeatingSession(
  request: CreateMobileSeatingSessionRequest
): Promise<CreateMobileSeatingSessionResponse> {
  return mobileV2Fetch<CreateMobileSeatingSessionResponse>("seating-sessions", {
    method: "POST",
    body: request,
  });
}

export async function getMobileSeatingSessionStatus(
  flowToken: string
): Promise<MobileSeatingSessionStatusResponse> {
  return mobileV2Fetch<MobileSeatingSessionStatusResponse>(
    `seating-sessions/${encodeURIComponent(flowToken)}/status`
  );
}

export async function getMobilePaymentReturnStatus(
  kind: "checkout" | "seating",
  token: string
): Promise<MobilePaymentReturnStatusResponse> {
  return mobileV2Fetch<MobilePaymentReturnStatusResponse>(
    `payment-return/${encodeURIComponent(token)}/status`,
    { params: { kind } }
  );
}

export async function getMobileOrders(params: {
  status?: string;
  limit?: number;
} = {}): Promise<MobileOrderSummary[]> {
  const response = await mobileV2Fetch<MobileOrdersResponse>("orders", {
    params: {
      status: params.status,
      limit: params.limit,
    },
  });
  return response.orders;
}

export async function getMobileOrder(orderId: number): Promise<MobileOrderSummary> {
  return mobileV2Fetch<MobileOrderSummary>(`orders/${orderId}`);
}

export async function getMobileOrderTickets(orderId: number): Promise<MobileOrderTicketsResponse> {
  return mobileV2Fetch<MobileOrderTicketsResponse>(`orders/${orderId}/tickets`);
}

export async function registerMobilePushToken(
  request: MobilePushTokenRequest
): Promise<{ success: boolean }> {
  return mobileV2Fetch<{ success: boolean }>("push-token", {
    method: "POST",
    body: request,
  });
}

export async function getMobileRewardsBalance(): Promise<MobileRewardsBalance> {
  return mobileV2Fetch<MobileRewardsBalance>("rewards/balance");
}

export async function getMobileRewardsHistory(limit = 20): Promise<MobileRewardTransaction[]> {
  const response = await mobileV2Fetch<MobileRewardsHistoryResponse>("rewards/history", {
    params: { limit },
  });
  return response.history;
}

export async function redeemMobileRewards(
  points: number,
  idempotencyKey?: string
): Promise<MobileRewardsRedeemResponse> {
  return mobileV2Fetch<MobileRewardsRedeemResponse>("rewards/redeem", {
    method: "POST",
    body: { points, idempotencyKey },
  });
}

export async function getMobileReferralCode(): Promise<MobileReferralCodeResponse> {
  return mobileV2Fetch<MobileReferralCodeResponse>("referral/code");
}

export async function validateMobileReferralCode(
  code: string
): Promise<MobileReferralValidateResponse> {
  return mobileV2Fetch<MobileReferralValidateResponse>("referral/validate", {
    method: "POST",
    body: { code },
    requireAuth: false,
  });
}

export async function registerMobileReferral(
  referrerCode: string
): Promise<MobileReferralRegisterResponse> {
  return mobileV2Fetch<MobileReferralRegisterResponse>("referral/register", {
    method: "POST",
    body: { referrerCode },
  });
}

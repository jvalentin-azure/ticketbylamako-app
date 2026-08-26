import { getStoredToken } from "./auth";
import type { CheckoutFieldSchema } from "@/lib/types/commerce";

export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
export const MOBILE_V2_SEATING_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_MOBILE_V2_SEATING !== "false";

type QueryValue = string | number | boolean | null | undefined;
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class MobileApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
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
  timeoutMs?: number;
}

function mobileV2Url(
  endpoint: string,
  params: Record<string, QueryValue> = {},
): string {
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
  options: MobileFetchOptions = {},
): Promise<T> {
  const requireAuth = options.requireAuth !== false;
  const token = options.token ?? (requireAuth ? await getStoredToken() : null);

  if (requireAuth && !token) {
    throw new MobileApiError(
      "Authentication required",
      401,
      "not_authenticated",
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? 30000;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let res: Response;
  try {
    res = await fetch(mobileV2Url(endpoint, options.params), {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new MobileApiError(
        "La requête a expiré. Vérifiez votre connexion puis réessayez.",
        408,
        "request_timeout",
      );
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const data = await parseResponse(res);
  if (!res.ok) {
    const body =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const message =
      typeof body.message === "string"
        ? body.message
        : `Mobile API error: ${res.status}`;
    const code = typeof body.code === "string" ? body.code : undefined;
    throw new MobileApiError(message, res.status, code, data);
  }

  return data as T;
}

export type CommerceLane = "product" | "ticket";
export type CheckoutFieldValue = string | string[];

export interface CheckoutAttendeeInput {
  fields: Record<string, CheckoutFieldValue>;
}

export interface MobileCheckoutItemInput {
  productId?: number;
  product_id?: number;
  variationId?: number;
  variation_id?: number;
  eventId?: number;
  event_id?: number;
  quantity: number;
  lane?: CommerceLane;
  attendees?: CheckoutAttendeeInput[];
}

interface MobileCheckoutItemPayload {
  product_id: number;
  variation_id?: number;
  event_id?: number;
  quantity: number;
  lane?: CommerceLane;
  attendees?: CheckoutAttendeeInput[];
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

export interface MobileProfile {
  id: number;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  billing: {
    phone: string;
    address_1: string;
    city: string;
    country: string;
  };
}

export async function getMobileProfile(): Promise<MobileProfile> {
  return mobileV2Fetch<MobileProfile>("profile");
}

export async function updateMobileProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  billing: MobileProfile["billing"];
}): Promise<MobileProfile> {
  return mobileV2Fetch<MobileProfile>("profile", {
    method: "POST",
    body: input,
  });
}

export interface CreateMobileCheckoutRequest {
  items: MobileCheckoutItemInput[];
  idempotencyKey?: string;
  billing?: MobileAddressInput;
  shipping?: MobileAddressInput;
  buyerFields?: Record<string, CheckoutFieldValue>;
  couponCode?: string;
  reservationExpiresAt?: string;
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

export interface MobileCheckoutFieldsItem {
  productId: number;
  eventId: number;
  name: string;
  quantity: number;
  requiresFields: boolean;
  hasFields: boolean;
  ownerFields: CheckoutFieldSchema[];
}

export interface MobileCheckoutFieldsResponse {
  buyerFields: CheckoutFieldSchema[];
  items: MobileCheckoutFieldsItem[];
  hasFields: boolean;
  requiresFields: boolean;
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
  | "review"
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
  seatLabels?: string[];
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
  couponCodes?: string[];
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
  reservationExpiresAt?: string | null;
  paymentAttemptStatus?: string | null;
  paymentPendingUntil?: string | null;
  paymentLastCheckedAt?: string | null;
  paymentPollCount?: number;
  requiresManualReview?: boolean;
  billing?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  items?: MobileOrderItem[];
  tickets?: MobileTicket[];
}

export type MobilePaymentKind = "checkout" | "seating";
export type MobilePaymentFlow = "success" | "pending" | "redirect" | "failed";

export interface MobilePaymentMethod {
  id: string;
  title: string;
  description: string;
  flow: "async" | "redirect";
  requiresPhone: boolean;
  iconUrl?: string;
}

export interface MobilePaymentMethodsResponse {
  kind: MobilePaymentKind;
  token: string;
  methods: MobilePaymentMethod[];
  order: MobileOrderSummary;
  zeroTotal: boolean;
  pollAfterMs: number;
}

export interface MobileCouponResponse {
  kind: MobilePaymentKind;
  token: string;
  order: MobileOrderSummary;
}

export interface MobilePaymentStartResponse {
  flow: MobilePaymentFlow;
  paymentStatus: MobilePaymentStatus;
  redirectUrl?: string;
  orderId: number;
  gatewayId?: string;
  attemptId?: string;
  pollAfterMs?: number;
  order: MobileOrderSummary;
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
  eventEndDate?: string;
  eventLocation?: string;
  eventImage?: string;
  appleWalletUrl?: string;
  googleWalletUrl?: string;
  appleWalletAvailable?: boolean;
  googleWalletAvailable?: boolean;
  checkedIn?: boolean;
  checkedInAt?: string;
  checkinCount?: number;
  seatLabel: string;
  seatId: string;
  status: string;
}

export interface MobileTicketWalletLink {
  platform: "apple" | "google";
  url: string;
  expiresAt: string | null;
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
  preferences?: {
    newEvents: boolean;
    orderUpdates: boolean;
    eventReminders: boolean;
    promotions: boolean;
  };
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

export interface MobileRewardsConfig {
  version: number;
  platform: string;
  program: {
    enabled: boolean;
    signup_bonus_points: number;
    earn_rate: {
      points: number;
      amount_ariary: number;
    };
    minimum_redeem_points: number;
    redemption_options: Array<{
      points: number;
      amount_ariary: number;
    }>;
    referral: {
      referrer_points: number;
      referred_points: number;
    };
  };
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

function normalizeCheckoutItems(
  items: MobileCheckoutItemInput[],
): MobileCheckoutItemPayload[] {
  return items.map((item) => {
    const productId = item.product_id ?? item.productId ?? 0;
    const variationId = item.variation_id ?? item.variationId;
    const eventId = item.event_id ?? item.eventId;
    return {
      product_id: productId,
      variation_id: variationId || undefined,
      event_id: eventId || undefined,
      quantity: item.quantity,
      lane: item.lane,
      attendees: item.attendees,
    };
  });
}

export async function getMobileCheckoutFields(
  items: MobileCheckoutItemInput[],
): Promise<MobileCheckoutFieldsResponse> {
  return mobileV2Fetch<MobileCheckoutFieldsResponse>("checkouts/fields", {
    method: "POST",
    body: { items: normalizeCheckoutItems(items) },
  });
}

export async function createMobileCheckout(
  request: CreateMobileCheckoutRequest,
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
  checkoutToken: string,
): Promise<MobileCheckoutStatusResponse> {
  return mobileV2Fetch<MobileCheckoutStatusResponse>(
    `checkouts/${encodeURIComponent(checkoutToken)}/status`,
  );
}

function requireMobileOrder(
  value: unknown,
  context: string,
): MobileOrderSummary {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as MobileOrderSummary).id !== "number" ||
    typeof (value as MobileOrderSummary).paymentStatus !== "string"
  ) {
    throw new Error(
      `${context}: la réponse du serveur est incomplète. Réessayez sans recréer votre panier.`,
    );
  }
  return value as MobileOrderSummary;
}

export async function getMobilePaymentMethods(
  token: string,
  kind: MobilePaymentKind,
): Promise<MobilePaymentMethodsResponse> {
  const response = await mobileV2Fetch<MobilePaymentMethodsResponse>(
    `payments/${encodeURIComponent(token)}/methods`,
    { params: { kind } },
  );
  if (!response || !Array.isArray(response.methods)) {
    throw new Error("Impossible de charger les moyens de paiement.");
  }
  response.order = requireMobileOrder(response.order, "Paiement");
  return response;
}

export async function updateMobilePaymentCoupon(
  token: string,
  kind: MobilePaymentKind,
  code: string,
  action: "apply" | "remove" = "apply",
): Promise<MobileCouponResponse> {
  const response = await mobileV2Fetch<MobileCouponResponse>(
    `payments/${encodeURIComponent(token)}/coupon`,
    {
      method: "POST",
      params: { kind },
      body: { code, action },
    },
  );
  if (!response) {
    throw new Error("Le serveur n'a pas confirmé le code promo.");
  }
  response.order = requireMobileOrder(response.order, "Code promo");
  return response;
}

export async function startMobilePayment(
  token: string,
  kind: MobilePaymentKind,
  input: {
    paymentMethod?: string;
    billingPhone?: string;
    attemptId: string;
  },
): Promise<MobilePaymentStartResponse> {
  const response = await mobileV2Fetch<MobilePaymentStartResponse>(
    `payments/${encodeURIComponent(token)}/start`,
    {
      method: "POST",
      params: { kind },
      body: input,
      timeoutMs: 30000,
    },
  );
  if (
    !response ||
    !["success", "pending", "redirect", "failed"].includes(response.flow)
  ) {
    throw new Error(
      "Le prestataire n'a pas confirmé le démarrage du paiement.",
    );
  }
  response.order = requireMobileOrder(response.order, "Paiement");
  if (response.flow === "redirect" && !response.redirectUrl) {
    throw new Error("Le lien sécurisé du prestataire est indisponible.");
  }
  return response;
}

export async function createMobileSeatingSession(
  request: CreateMobileSeatingSessionRequest,
): Promise<CreateMobileSeatingSessionResponse> {
  return mobileV2Fetch<CreateMobileSeatingSessionResponse>("seating-sessions", {
    method: "POST",
    body: request,
  });
}

export async function getMobileSeatingSessionStatus(
  flowToken: string,
): Promise<MobileSeatingSessionStatusResponse> {
  return mobileV2Fetch<MobileSeatingSessionStatusResponse>(
    `seating-sessions/${encodeURIComponent(flowToken)}/status`,
  );
}

export async function getMobilePaymentReturnStatus(
  kind: "checkout" | "seating",
  token: string,
): Promise<MobilePaymentReturnStatusResponse> {
  return mobileV2Fetch<MobilePaymentReturnStatusResponse>(
    `payment-return/${encodeURIComponent(token)}/status`,
    { params: { kind } },
  );
}

export async function verifyMobilePayment(
  kind: MobilePaymentKind,
  token: string,
): Promise<MobilePaymentReturnStatusResponse> {
  const response = await mobileV2Fetch<MobilePaymentReturnStatusResponse>(
    `payments/${encodeURIComponent(token)}/verify`,
    {
      method: "POST",
      params: { kind },
      timeoutMs: 30000,
    },
  );
  if (!response) {
    throw new Error("Le serveur n'a pas pu vérifier le paiement.");
  }
  if (response.order) {
    response.order = requireMobileOrder(
      response.order,
      "Vérification du paiement",
    );
  }
  return response;
}

export async function cancelMobilePayment(
  kind: MobilePaymentKind,
  token: string,
): Promise<MobilePaymentReturnStatusResponse> {
  const response = await mobileV2Fetch<MobilePaymentReturnStatusResponse>(
    `payments/${encodeURIComponent(token)}/cancel`,
    {
      method: "POST",
      params: { kind },
      timeoutMs: 15000,
    },
  );
  if (!response || response.status !== "cancelled") {
    throw new Error("Le serveur n'a pas confirmé l'annulation du paiement.");
  }
  if (response.order) {
    response.order = requireMobileOrder(
      response.order,
      "Annulation du paiement",
    );
  }
  return response;
}

export async function getMobileOrders(
  params: {
    status?: string;
    limit?: number;
    includeTickets?: boolean;
  } = {},
): Promise<MobileOrderSummary[]> {
  const response = await mobileV2Fetch<MobileOrdersResponse>("orders", {
    params: {
      status: params.status,
      limit: params.limit,
      include_tickets: params.includeTickets ? 1 : undefined,
      view: params.includeTickets ? "tickets" : undefined,
    },
  });
  return response.orders;
}

export async function getMobileOrder(
  orderId: number,
): Promise<MobileOrderSummary> {
  return mobileV2Fetch<MobileOrderSummary>(`orders/${orderId}`);
}

export async function getMobileOrderTickets(
  orderId: number,
): Promise<MobileOrderTicketsResponse> {
  return mobileV2Fetch<MobileOrderTicketsResponse>(`orders/${orderId}/tickets`);
}

export async function getMobileTicketWalletLink(
  orderId: number,
  ticketId: number,
  platform: "apple" | "google",
): Promise<MobileTicketWalletLink> {
  return mobileV2Fetch<MobileTicketWalletLink>(
    `orders/${orderId}/tickets/${ticketId}/wallet/${platform}`,
  );
}

export async function registerMobilePushToken(
  request: MobilePushTokenRequest,
): Promise<{ success: boolean }> {
  return mobileV2Fetch<{ success: boolean }>("push-token", {
    method: "POST",
    body: request,
  });
}

export async function unregisterMobilePushToken(
  request: MobilePushTokenRequest,
): Promise<{ success: boolean; removed?: number }> {
  return mobileV2Fetch<{ success: boolean; removed?: number }>("push-token", {
    method: "DELETE",
    body: request,
  });
}

export async function getMobileRewardsBalance(): Promise<MobileRewardsBalance> {
  return mobileV2Fetch<MobileRewardsBalance>("rewards/balance", {
    params: { fresh: Date.now() },
  });
}

export async function getMobileRewardsConfig(): Promise<MobileRewardsConfig> {
  return mobileV2Fetch<MobileRewardsConfig>("rewards/config", {
    requireAuth: false,
    params: { fresh: Date.now() },
  });
}

export async function getMobileRewardsHistory(
  limit = 20,
): Promise<MobileRewardTransaction[]> {
  const response = await mobileV2Fetch<MobileRewardsHistoryResponse>(
    "rewards/history",
    {
      params: { limit, fresh: Date.now() },
    },
  );
  return response.history;
}

export async function redeemMobileRewards(
  points: number,
  idempotencyKey?: string,
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
  code: string,
): Promise<MobileReferralValidateResponse> {
  return mobileV2Fetch<MobileReferralValidateResponse>("referral/validate", {
    method: "POST",
    body: { code },
    requireAuth: false,
  });
}

export async function registerMobileReferral(
  referrerCode: string,
): Promise<MobileReferralRegisterResponse> {
  return mobileV2Fetch<MobileReferralRegisterResponse>("referral/register", {
    method: "POST",
    body: { referrerCode },
  });
}

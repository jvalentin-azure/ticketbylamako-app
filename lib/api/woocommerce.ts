/**
 * Deprecated compatibility facade.
 *
 * The mobile app must not call WooCommerce REST endpoints directly. Runtime
 * commerce now goes through JWT-authenticated lamako-mobile/v2 routes in
 * `catalog.ts` and `mobile.ts`.
 */
import { getEventsData, getShopProducts } from "./catalog";
import { getMobileOrders, registerMobilePushToken } from "./mobile";
export * from "./catalog";
export {
  createMobileCheckout,
  getMobileCheckoutStatus,
  getMobileOrder,
  getMobileOrders,
  getMobileOrderTickets,
  getMobilePaymentReturnStatus,
  getMobileSeatingSessionStatus,
} from "./mobile";

export async function createOrder(): Promise<never> {
  throw new Error(
    "Direct mobile order creation has been removed. Use createMobileCheckout().",
  );
}

export async function getEventsWithTickets() {
  return (await getEventsData()).events;
}

export async function getProducts(params: Record<string, string> = {}) {
  return getShopProducts(params);
}

export async function getCustomerOrders() {
  return getMobileOrders({ limit: 50 });
}

export async function getAllOrders() {
  return getMobileOrders({ limit: 50 });
}

export async function registerPushToken(
  token: string,
  _userId?: number,
  platform?: string,
) {
  void _userId;
  try {
    return await registerMobilePushToken({ token, platform });
  } catch (error) {
    return { success: false, error };
  }
}

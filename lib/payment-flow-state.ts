const PAYMENT_STATE_TTL_MS = 30 * 60 * 1000;

const terminalTokens = new Map<string, number>();
const notifiedOrders = new Map<number, number>();
const celebratedOrders = new Map<number, number>();

function prune(store: Map<string | number, number>, now = Date.now()) {
  for (const [key, timestamp] of store) {
    if (now - timestamp > PAYMENT_STATE_TTL_MS) store.delete(key);
  }
}

function claim(
  store: Map<string | number, number>,
  key: string | number,
): boolean {
  const now = Date.now();
  prune(store, now);
  if (store.has(key)) return false;
  store.set(key, now);
  return true;
}

export function claimTerminalPaymentToken(token: string): boolean {
  if (!token) return false;
  return claim(terminalTokens, token);
}

export function hasTerminalPaymentToken(token: string): boolean {
  prune(terminalTokens);
  return !!token && terminalTokens.has(token);
}

export function claimPaymentNotification(orderId: number): boolean {
  return orderId > 0 && claim(notifiedOrders, orderId);
}

export function claimPaymentCelebration(orderId: number): boolean {
  return orderId > 0 && claim(celebratedOrders, orderId);
}


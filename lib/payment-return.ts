import {
  getMobilePaymentReturnStatus,
  type MobileOrderSummary,
  type MobilePaymentStatus,
} from "@/lib/api/mobile";

export type PaymentReturnKind = "checkout" | "seating";
export type PaymentReturnStatus = MobilePaymentStatus | "active";

export interface PaymentReturnInput {
  kind: PaymentReturnKind;
  token: string;
  statusHint?: string;
}

export interface VerifiedPaymentReturn {
  kind: PaymentReturnKind;
  token: string;
  status: PaymentReturnStatus;
  order: MobileOrderSummary | null;
  ticketsReady: boolean;
}

export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function normalizePaymentReturnKind(value: string | undefined): PaymentReturnKind | null {
  if (value === "checkout" || value === "seating") return value;
  return null;
}

export function isPaymentReturnSuccess(status: PaymentReturnStatus): boolean {
  return status === "success";
}

export function isPaymentReturnPending(status: PaymentReturnStatus): boolean {
  return status === "pending" || status === "active";
}

export function parsePaymentReturnUrl(url: string): PaymentReturnInput | null {
  try {
    const parsed = new URL(url);
    const isAppReturn = parsed.protocol === "ticketbylamako:";
    const isWebReturn = parsed.pathname.includes("/lamako-mobile/payment-");
    if (!isAppReturn && !isWebReturn) return null;

    const kind = normalizePaymentReturnKind(parsed.searchParams.get("kind") || undefined);
    const tokenFromQuery = parsed.searchParams.get("token") || "";
    const tokenFromPath = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const token = tokenFromQuery || tokenFromPath;

    if (!kind || !token) return null;

    return {
      kind,
      token,
      statusHint: parsed.searchParams.get("status") || undefined,
    };
  } catch {
    return null;
  }
}

export async function verifyPaymentReturn(input: PaymentReturnInput): Promise<VerifiedPaymentReturn> {
  const status = await getMobilePaymentReturnStatus(input.kind, input.token);
  return {
    kind: status.kind,
    token: status.token,
    status: status.status,
    order: status.order,
    ticketsReady: status.ticketsReady,
  };
}

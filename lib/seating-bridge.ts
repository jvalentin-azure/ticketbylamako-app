export interface SeatingBridgeOrder {
  id?: number;
  orderId?: number;
  total?: number | string;
  seatLabels?: unknown[];
  seats?: unknown[];
}

export interface SeatingSelectionSnapshot {
  selectedCount: number;
  inCartCount: number;
  pendingCount: number;
  seatLabels: string[];
}

function seatLabel(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (!value || typeof value !== "object") return "";

  const seat = value as Record<string, unknown>;
  const label = seat.label ?? seat.seatLabel ?? seat.name ?? seat.id;
  return typeof label === "string" || typeof label === "number"
    ? String(label).trim()
    : "";
}

export function normalizeSeatLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(seatLabel).filter(Boolean)));
}

export function seatingSelectionSnapshot(
  payload: Record<string, unknown> | undefined,
): SeatingSelectionSnapshot {
  const seatLabels = normalizeSeatLabels(
    payload?.seatLabels ?? payload?.seats ?? payload?.labels,
  );
  const selectedCount = Number(
    payload?.selectedCount ?? seatLabels.length ?? 0,
  );
  const inCartCount = Number(payload?.inCartCount ?? payload?.count ?? 0);
  const pendingCount = Number(
    payload?.pendingCount ?? Math.max(0, selectedCount - inCartCount),
  );

  return {
    selectedCount: Number.isFinite(selectedCount)
      ? Math.max(0, selectedCount)
      : 0,
    inCartCount: Number.isFinite(inCartCount) ? Math.max(0, inCartCount) : 0,
    pendingCount: Number.isFinite(pendingCount) ? Math.max(0, pendingCount) : 0,
    seatLabels,
  };
}

export function seatingOrderId(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const order = value as SeatingBridgeOrder;
  return Number(order.id || order.orderId || 0);
}

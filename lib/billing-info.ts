const MAX_FIELD_LENGTH = 250;

export interface StoredBillingInfo {
  phone: string;
  address: string;
  city: string;
}

function normalizeField(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_FIELD_LENGTH)
    : "";
}

export function parseStoredBillingInfo(
  value: string | null,
): StoredBillingInfo | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const billing = {
      phone: normalizeField(record.phone),
      address: normalizeField(record.address),
      city: normalizeField(record.city),
    };

    return billing.phone || billing.address || billing.city ? billing : null;
  } catch {
    return null;
  }
}

export type StoredUserRole = "customer" | "shop_manager" | "administrator";

export interface StoredUserData {
  id: number;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: StoredUserRole;
  avatar?: string;
}

const USER_ROLES = new Set<StoredUserRole>([
  "customer",
  "shop_manager",
  "administrator",
]);

function cleanText(value: unknown, maxLength = 250): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function parseStoredUser(value: string | null): StoredUserData | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const id = typeof record.id === "number" ? record.id : Number(record.id);
    const email = cleanText(record.email).toLowerCase();
    if (!Number.isSafeInteger(id) || id <= 0 || !email.includes("@")) {
      return null;
    }

    const storedRole = cleanText(record.role) as StoredUserRole;
    const role = USER_ROLES.has(storedRole) ? storedRole : "customer";
    const avatar = cleanText(record.avatar, 2_000);

    return {
      id,
      email,
      displayName: cleanText(record.displayName) || email,
      firstName: cleanText(record.firstName),
      lastName: cleanText(record.lastName),
      role,
      ...(avatar ? { avatar } : {}),
    };
  } catch {
    return null;
  }
}

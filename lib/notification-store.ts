export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: string;
  read: boolean;
}

const MAX_NOTIFICATIONS = 50;

function isAppNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AppNotification>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.receivedAt === "string" &&
    !Number.isNaN(Date.parse(item.receivedAt)) &&
    typeof item.read === "boolean" &&
    (item.data === undefined ||
      (typeof item.data === "object" && item.data !== null))
  );
}

export function normalizeStoredNotifications(value: unknown): AppNotification[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isAppNotification)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, MAX_NOTIFICATIONS);
}

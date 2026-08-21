export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  receivedAt: string;
  read: boolean;
}

export interface NotificationPreferences {
  newEvents: boolean;
  orderUpdates: boolean;
  eventReminders: boolean;
  promotions: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newEvents: true,
  orderUpdates: true,
  eventReminders: true,
  promotions: true,
};

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

export function normalizeNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const stored = value as Record<string, unknown>;
  return {
    newEvents:
      typeof stored.newEvents === "boolean"
        ? stored.newEvents
        : DEFAULT_NOTIFICATION_PREFERENCES.newEvents,
    orderUpdates:
      typeof stored.orderUpdates === "boolean"
        ? stored.orderUpdates
        : DEFAULT_NOTIFICATION_PREFERENCES.orderUpdates,
    eventReminders:
      typeof stored.eventReminders === "boolean"
        ? stored.eventReminders
        : DEFAULT_NOTIFICATION_PREFERENCES.eventReminders,
    promotions:
      typeof stored.promotions === "boolean"
        ? stored.promotions
        : DEFAULT_NOTIFICATION_PREFERENCES.promotions,
  };
}

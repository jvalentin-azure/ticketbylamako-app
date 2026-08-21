export interface NotificationTarget {
  href: string;
  actionLabel: string;
  requiresAuth: boolean;
}

type NotificationData = Record<string, unknown>;

function asData(value: unknown): NotificationData | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as NotificationData)
    : null;
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function aliasedId(
  data: NotificationData,
  camelCaseKey: string,
  snakeCaseKey: string,
): number | null {
  return positiveInteger(data[camelCaseKey] ?? data[snakeCaseKey]);
}

function targetFromSafeUrl(value: unknown): NotificationTarget | null {
  if (typeof value !== "string") return null;

  const match = value.match(/^\/(event|order|ticket)\/(\d+)\/?$/);
  if (match) {
    const id = positiveInteger(match[2]);
    if (!id) return null;
    const section = match[1];
    return {
      href: `/${section}/${id}`,
      actionLabel:
        section === "event"
          ? "Voir l'événement"
          : section === "ticket"
            ? "Voir le billet"
            : "Voir la commande",
      requiresAuth: section !== "event",
    };
  }

  if (value === "/orders") {
    return {
      href: "/orders",
      actionLabel: "Voir mes commandes",
      requiresAuth: true,
    };
  }

  return null;
}

export function notificationTargetFromData(
  value: unknown,
): NotificationTarget | null {
  const data = asData(value);
  if (!data) return null;

  const type = typeof data.type === "string" ? data.type : "";
  const eventId = aliasedId(data, "eventId", "event_id");
  const orderId = aliasedId(data, "orderId", "order_id");
  const ticketId = aliasedId(data, "ticketId", "ticket_id") ?? orderId;

  if ((type === "new_event" || type === "event_reminder") && eventId) {
    return {
      href: `/event/${eventId}`,
      actionLabel: "Voir l'événement",
      requiresAuth: false,
    };
  }

  if ((type === "order_update" || type === "payment_confirmed") && orderId) {
    return {
      href: `/order/${orderId}`,
      actionLabel: "Voir la commande",
      requiresAuth: true,
    };
  }

  if (type === "ticket_ready" && ticketId) {
    return {
      href: `/ticket/${ticketId}`,
      actionLabel: "Voir le billet",
      requiresAuth: true,
    };
  }

  return targetFromSafeUrl(data.url);
}

export function notificationDestinationForAuth(
  target: NotificationTarget,
  isAuthenticated: boolean,
): string {
  return target.requiresAuth && !isAuthenticated
    ? `/(auth)/login?returnTo=${encodeURIComponent(target.href)}`
    : target.href;
}

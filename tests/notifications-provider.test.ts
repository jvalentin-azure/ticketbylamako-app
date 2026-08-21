import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeStoredNotification,
  normalizeNotificationPreferences,
  normalizeStoredNotifications,
  notificationPreferencesStorageKey,
  notificationSectionLabel,
  notificationStorageKey,
} from "../lib/notification-store";
import {
  notificationDestinationForAuth,
  notificationTargetFromData,
} from "../lib/notification-navigation";

const validNotification = {
  id: "notification-1",
  title: "Commande confirmée",
  body: "Votre billet est disponible.",
  receivedAt: "2026-08-21T10:00:00.000Z",
  read: false,
};

describe("notification storage normalization", () => {
  it("normalizes malformed notification preferences", () => {
    expect(
      normalizeNotificationPreferences({
        newEvents: false,
        orderUpdates: "yes",
        promotions: false,
      }),
    ).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      newEvents: false,
      promotions: false,
    });
  });

  it("rejects invalid storage values", () => {
    expect(normalizeStoredNotifications(null)).toEqual([]);
    expect(
      normalizeStoredNotifications({ notification: validNotification }),
    ).toEqual([]);
  });

  it("removes malformed and duplicate notifications", () => {
    expect(
      normalizeStoredNotifications([
        validNotification,
        { ...validNotification, title: "Duplicate" },
        { id: "broken" },
      ]),
    ).toEqual([validNotification]);
  });

  it("caps local history at fifty notifications", () => {
    const notifications = Array.from({ length: 60 }, (_, index) => ({
      ...validNotification,
      id: `notification-${index}`,
    }));
    expect(normalizeStoredNotifications(notifications)).toHaveLength(50);
  });

  it("isolates notification data and preferences by account", () => {
    expect(notificationStorageKey(12)).toBe("tbl_notifications:12");
    expect(notificationStorageKey(13)).not.toBe(notificationStorageKey(12));
    expect(notificationPreferencesStorageKey(12)).toBe(
      "tbl_notification_prefs:12",
    );
  });

  it("groups notifications into readable date sections", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    expect(notificationSectionLabel("2026-08-21T08:00:00.000Z", now)).toBe(
      "Aujourd'hui",
    );
    expect(notificationSectionLabel("2026-08-18T08:00:00.000Z", now)).toBe(
      "Cette semaine",
    );
    expect(notificationSectionLabel("2026-07-01T08:00:00.000Z", now)).toBe(
      "Plus tôt",
    );
  });

  it("marks a tapped notification read without changing its received date", () => {
    const updated = mergeStoredNotification([validNotification], {
      ...validNotification,
      receivedAt: "2026-08-21T12:00:00.000Z",
      read: true,
    });
    expect(updated[0]).toEqual({ ...validNotification, read: true });
  });
});

describe("notification account security", () => {
  const root = path.resolve(__dirname, "..");
  const provider = fs.readFileSync(
    path.join(root, "lib", "notifications-provider.tsx"),
    "utf8",
  );
  const auth = fs.readFileSync(
    path.join(root, "lib", "auth-provider.tsx"),
    "utf8",
  );
  const backend = fs.readFileSync(
    path.join(
      root,
      "scripts",
      "lamako-mobile-api",
      "includes",
      "v2-commerce.php",
    ),
    "utf8",
  );

  it("scopes inbox storage to the authenticated user", () => {
    expect(provider).toContain("notificationStorageKey(user?.id)");
    expect(provider).not.toContain('AsyncStorage.setItem("tbl_notifications"');
  });

  it("revokes the device token on logout with a bounded wait", () => {
    expect(auth).toContain("unregisterPushTokenWithBackend");
    expect(auth).toContain("Promise.race");
    expect(backend).toContain("lamako_mobile_v2_unregister_push_token");
    expect(backend).toContain("WP_REST_Server::DELETABLE");
    expect(backend).toContain("get_current_user_id()");
  });
});

describe("notification navigation", () => {
  it("supports server snake_case and app camelCase event payloads", () => {
    expect(
      notificationTargetFromData({ type: "new_event", event_id: 12673 }),
    ).toEqual({
      href: "/event/12673",
      actionLabel: "Voir l'événement",
      requiresAuth: false,
    });
    expect(
      notificationTargetFromData({ type: "event_reminder", eventId: "12673" }),
    ).toEqual({
      href: "/event/12673",
      actionLabel: "Voir l'événement",
      requiresAuth: false,
    });
  });

  it("routes private order and ticket notifications", () => {
    expect(
      notificationTargetFromData({ type: "order_update", order_id: "13749" }),
    ).toEqual({
      href: "/order/13749",
      actionLabel: "Voir la commande",
      requiresAuth: true,
    });
    expect(
      notificationTargetFromData({ type: "ticket_ready", orderId: 13749 }),
    ).toEqual({
      href: "/ticket/13749",
      actionLabel: "Voir le billet",
      requiresAuth: true,
    });
  });

  it("accepts only allowlisted local fallback URLs", () => {
    expect(notificationTargetFromData({ url: "/orders" })?.href).toBe(
      "/orders",
    );
    expect(notificationTargetFromData({ url: "/event/42" })?.href).toBe(
      "/event/42",
    );
    expect(
      notificationTargetFromData({ url: "https://example.com" }),
    ).toBeNull();
    expect(notificationTargetFromData({ url: "/checkout" })).toBeNull();
  });

  it("rejects malformed and unsafe identifiers", () => {
    expect(
      notificationTargetFromData({
        type: "order_update",
        order_id: "1/../../2",
      }),
    ).toBeNull();
    expect(
      notificationTargetFromData({ type: "new_event", event_id: -1 }),
    ).toBeNull();
    expect(notificationTargetFromData(null)).toBeNull();
  });

  it("preserves private destinations through login", () => {
    const target = notificationTargetFromData({
      type: "order_update",
      order_id: 13749,
    });
    expect(target).not.toBeNull();
    expect(notificationDestinationForAuth(target!, false)).toBe(
      "/(auth)/login?returnTo=%2Forder%2F13749",
    );
    expect(notificationDestinationForAuth(target!, true)).toBe("/order/13749");
  });
});

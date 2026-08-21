import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  normalizeStoredNotifications,
  notificationPreferencesStorageKey,
  notificationSectionLabel,
  notificationStorageKey,
} from "../lib/notification-store";

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

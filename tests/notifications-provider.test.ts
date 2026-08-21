import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  normalizeStoredNotifications,
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
    expect(normalizeStoredNotifications({ notification: validNotification })).toEqual([]);
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
});

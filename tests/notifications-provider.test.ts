import { describe, expect, it } from "vitest";
import { normalizeStoredNotifications } from "../lib/notification-store";

const validNotification = {
  id: "notification-1",
  title: "Commande confirmée",
  body: "Votre billet est disponible.",
  receivedAt: "2026-08-21T10:00:00.000Z",
  read: false,
};

describe("notification storage normalization", () => {
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

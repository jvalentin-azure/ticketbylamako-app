import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("V2.4 - Event Filters, Favorites, Sharing, Push Notifications", () => {
  describe("Event Filters", () => {
    const eventsContent = readFileSync(join(ROOT, "app/(tabs)/events.tsx"), "utf-8");

    it("events screen imports getEventCategories", () => {
      expect(eventsContent).toContain("getEventCategories");
    });

    it("events screen has category chip filter", () => {
      expect(eventsContent).toContain("selectedCat");
      expect(eventsContent).toContain("parentCategories");
    });

    it("events screen has date filter state", () => {
      expect(eventsContent).toContain("dateFilter");
      expect(eventsContent).toContain('"today"');
      expect(eventsContent).toContain('"week"');
      expect(eventsContent).toContain('"month"');
      expect(eventsContent).toContain('"upcoming"');
    });

    it("events screen has date filter modal", () => {
      expect(eventsContent).toContain("showDateFilter");
      expect(eventsContent).toContain("Modal");
      expect(eventsContent).toContain("Filtrer par date");
    });

    it("events screen filters by child categories of parent", () => {
      expect(eventsContent).toContain("getChildCategoryIds");
      expect(eventsContent).toContain("event_category");
    });

    it("events screen has clear filters button", () => {
      expect(eventsContent).toContain("Effacer");
      expect(eventsContent).toContain("activeFilterCount");
    });
  });

  describe("Favorites Provider", () => {
    it("favorites provider file exists", () => {
      expect(existsSync(join(ROOT, "lib/favorites-provider.tsx"))).toBe(true);
    });

    const favContent = readFileSync(join(ROOT, "lib/favorites-provider.tsx"), "utf-8");

    it("favorites provider uses AsyncStorage for persistence", () => {
      expect(favContent).toContain("AsyncStorage");
      expect(favContent).toContain("tbl_favorites");
    });

    it("favorites provider exports useFavorites hook", () => {
      expect(favContent).toContain("export function useFavorites");
    });

    it("favorites provider has toggleFavorite function", () => {
      expect(favContent).toContain("toggleFavorite");
    });

    it("favorites provider has isFavorite function", () => {
      expect(favContent).toContain("isFavorite");
    });

    it("favorites provider supports event and product types", () => {
      expect(favContent).toContain('"event"');
      expect(favContent).toContain('"product"');
    });

    it("favorites provider has favoriteEvents and favoriteProducts computed", () => {
      expect(favContent).toContain("favoriteEvents");
      expect(favContent).toContain("favoriteProducts");
    });
  });

  describe("Favorites Screen", () => {
    it("favorites screen file exists", () => {
      expect(existsSync(join(ROOT, "app/favorites.tsx"))).toBe(true);
    });

    const favScreenContent = readFileSync(join(ROOT, "app/favorites.tsx"), "utf-8");

    it("favorites screen has tabs for all/events/products", () => {
      expect(favScreenContent).toContain('"all"');
      expect(favScreenContent).toContain('"events"');
      expect(favScreenContent).toContain('"products"');
    });

    it("favorites screen uses useFavorites hook", () => {
      expect(favScreenContent).toContain("useFavorites");
    });

    it("favorites screen has remove favorite functionality", () => {
      expect(favScreenContent).toContain("removeFavorite");
    });

    it("favorites screen navigates to event/product detail", () => {
      expect(favScreenContent).toContain("/event/");
      expect(favScreenContent).toContain("/product/");
    });
  });

  describe("Favorite Buttons on Cards", () => {
    const homeContent = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf-8");
    const eventsContent = readFileSync(join(ROOT, "app/(tabs)/events.tsx"), "utf-8");
    const eventDetailContent = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");

    it("home screen has favorite buttons on event cards", () => {
      expect(homeContent).toContain("toggleFavorite");
      expect(homeContent).toContain("isFavorite");
      expect(homeContent).toContain("heart.fill");
    });

    it("events list has favorite buttons", () => {
      expect(eventsContent).toContain("toggleFavorite");
      expect(eventsContent).toContain("isFavorite");
      expect(eventsContent).toContain("favBtn");
    });

    it("event detail has favorite button", () => {
      expect(eventDetailContent).toContain("toggleFavorite");
      expect(eventDetailContent).toContain("isFavorite");
    });
  });

  describe("Drawer Favorites Link", () => {
    const drawerContent = readFileSync(join(ROOT, "components/drawer-content.tsx"), "utf-8");

    it("drawer has Mes Favoris link", () => {
      expect(drawerContent).toContain("Mes Favoris");
      expect(drawerContent).toContain("/favorites");
    });
  });

  describe("Social Sharing", () => {
    const eventDetailContent = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");

    it("event detail imports Share from react-native", () => {
      expect(eventDetailContent).toContain("Share");
    });

    it("event detail has share button", () => {
      expect(eventDetailContent).toContain("Share.share");
      expect(eventDetailContent).toContain("square.and.arrow.up");
    });

    it("share includes event name and URL", () => {
      expect(eventDetailContent).toContain("ticketbylamako.com");
      expect(eventDetailContent).toContain("Découvrez cet événement");
    });
  });

  describe("Push Notifications", () => {
    it("notifications service file exists", () => {
      expect(existsSync(join(ROOT, "lib/notifications.ts"))).toBe(true);
    });

    const notifContent = readFileSync(join(ROOT, "lib/notifications.ts"), "utf-8");

    it("notification service sets up handler", () => {
      expect(notifContent).toContain("setupNotificationHandler");
      expect(notifContent).toContain("setNotificationHandler");
    });

    it("notification service creates Android channels", () => {
      expect(notifContent).toContain("setNotificationChannelAsync");
      expect(notifContent).toContain("TicketByLamako");
      expect(notifContent).toContain("Événements");
      expect(notifContent).toContain("Commandes");
    });

    it("notification service registers for push tokens", () => {
      expect(notifContent).toContain("registerForPushNotificationsAsync");
      expect(notifContent).toContain("getExpoPushTokenAsync");
    });

    it("notification service has event reminder scheduling", () => {
      expect(notifContent).toContain("scheduleEventReminder");
      expect(notifContent).toContain("Rappel d'événement");
    });

    it("notification service stores preferences in AsyncStorage", () => {
      expect(notifContent).toContain("tbl_notification_prefs");
      expect(notifContent).toContain("saveNotificationPreferences");
      expect(notifContent).toContain("getNotificationPreferences");
    });

    it("notification service checks for physical device", () => {
      expect(notifContent).toContain("Device.isDevice");
    });
  });

  describe("Root Layout Integration", () => {
    const layoutContent = readFileSync(join(ROOT, "app/_layout.tsx"), "utf-8");

    it("root layout imports notification setup", () => {
      expect(layoutContent).toContain("setupNotificationHandler");
      expect(layoutContent).toContain("registerForPushNotificationsAsync");
    });

    it("root layout wraps with FavoritesProvider", () => {
      expect(layoutContent).toContain("FavoritesProvider");
    });

    it("root layout has favorites route", () => {
      expect(layoutContent).toContain('name="favorites"');
    });

    it("root layout sets up notification listeners", () => {
      expect(layoutContent).toContain("addNotificationReceivedListener");
      expect(layoutContent).toContain("addNotificationResponseReceivedListener");
    });

    it("root layout handles notification deep links to events", () => {
      expect(layoutContent).toContain("event_reminder");
      expect(layoutContent).toContain("eventId");
    });
  });

  describe("Format Utilities", () => {
    const formatContent = readFileSync(join(ROOT, "lib/format.ts"), "utf-8");

    it("format.ts has timeAgo function", () => {
      expect(formatContent).toContain("export function timeAgo");
      expect(formatContent).toContain("à l'instant");
      expect(formatContent).toContain("il y a");
    });
  });
});

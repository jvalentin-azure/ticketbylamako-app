import { describe, it, expect, vi } from "vitest";

// Mock react-native Platform
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

// Mock expo-notifications
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: vi
    .fn()
    .mockResolvedValue({ data: "ExponentPushToken[test123]" }),
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  getBadgeCountAsync: vi.fn().mockResolvedValue(0),
  setBadgeCountAsync: vi.fn(),
  addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// Mock expo-device
vi.mock("expo-device", () => ({
  isDevice: true,
}));

// Mock expo-constants
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: "test-project-id" },
      },
    },
  },
}));

describe("V2.8 - Push Token Registration API", () => {
  it("registerPushToken function exists and accepts correct parameters", async () => {
    // Mock the fetch for the mobile API
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, message: "Token registered" }),
    });
    global.fetch = mockFetch;

    // Set env vars for the API
    process.env.EXPO_PUBLIC_WC_CONSUMER_KEY = "test_ck";
    process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET = "test_cs";
    process.env.EXPO_PUBLIC_SITE_URL = "https://www.ticketbylamako.com";

    const { registerPushToken } = await import("../lib/api/woocommerce");

    const result = await registerPushToken(
      "ExponentPushToken[test123]",
      42,
      "ios",
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify the fetch was called with correct endpoint
    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain("register-push-token");
    expect(callArgs[1].method).toBe("POST");
    const body = JSON.parse(callArgs[1].body);
    expect(body.token).toBe("ExponentPushToken[test123]");
    expect(body.user_id).toBe(42);
    expect(body.platform).toBe("ios");
  });

  it("registerPushToken handles API errors gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    global.fetch = mockFetch;

    process.env.EXPO_PUBLIC_WC_CONSUMER_KEY = "test_ck";
    process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET = "test_cs";
    process.env.EXPO_PUBLIC_SITE_URL = "https://www.ticketbylamako.com";

    // Re-import to get fresh module
    vi.resetModules();
    const { registerPushToken } = await import("../lib/api/woocommerce");

    const result = await registerPushToken(
      "ExponentPushToken[test123]",
      0,
      "android",
    );

    // Should not throw, should return failure
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });
});

describe("V2.8 - Checkout WebView Import", () => {
  it("checkout.tsx uses .default for WebView import (not .WebView)", async () => {
    const fs = await import("fs");
    const checkoutCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/app/checkout.tsx",
      "utf-8",
    );

    // Should use .default, not .WebView
    expect(checkoutCode).toContain('require("react-native-webview").default');
    expect(checkoutCode).not.toContain(
      'require("react-native-webview").WebView',
    );

    // Should have Platform guard
    expect(checkoutCode).toContain('Platform.OS !== "web"');
  });
});

describe("V2.8 - CGV Link in About Screen", () => {
  it("about.tsx contains CGV link to WordPress page", async () => {
    const fs = await import("fs");
    const aboutCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/app/about.tsx",
      "utf-8",
    );

    // Should have CGV link
    expect(aboutCode).toContain("conditions-generales-de-vente");
    expect(aboutCode).toContain("Conditions Générales de Vente");
    expect(aboutCode).toContain("gavel"); // MaterialIcons icon name
  });
});

describe("V2.8 - Seating Chart Fixes", () => {
  it("event detail does not hide .tc_in_cart in CSS injection", async () => {
    const fs = await import("fs");
    const eventCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/app/event/[id].tsx",
      "utf-8",
    );

    // .tc_in_cart should NOT be in the display:none list
    // It should be styled to be visible (fixed position at bottom)
    expect(eventCode).toContain(".tc_in_cart { position: fixed");
    expect(eventCode).not.toMatch(/\.tc_in_cart[^{]*\{[^}]*display:\s*none/);
  });

  it("seat extraction JS uses multiple selectors for robustness", async () => {
    const fs = await import("fs");
    const eventCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/app/event/[id].tsx",
      "utf-8",
    );

    // Should have multiple seat selectors
    expect(eventCode).toContain("tc_seat_in_cart");
    expect(eventCode).toContain("tc_set_seat");
    expect(eventCode).toContain("tc_seat_selected");
    expect(eventCode).toContain("tc_seat.selected");

    // Should have deduplication logic
    expect(eventCode).toContain("seen[key]");
  });
});

describe("V2.8 - Push Notification Tap Handling", () => {
  it("root layout handles order_update and new_event notification types", async () => {
    const fs = await import("fs");
    const layoutCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/app/_layout.tsx",
      "utf-8",
    );

    // Should handle order_update
    expect(layoutCode).toContain('data?.type === "order_update"');
    expect(layoutCode).toContain("data?.orderId");

    // Should handle new_event
    expect(layoutCode).toContain('data?.type === "new_event"');

    // Should import registerPushTokenWithBackend
    expect(layoutCode).toContain("registerPushTokenWithBackend");
  });
});

describe("V2.8 - WordPress Plugin Fixes", () => {
  it("WordPress plugin does not hide .tc_in_cart in seating embed", async () => {
    const fs = await import("fs");
    const pluginCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/scripts/lamako-mobile-api.php",
      "utf-8",
    );

    // The seating embed CSS should NOT hide .tc_in_cart
    // Check that .tc_in_cart is not in a display:none rule
    const cssSection = pluginCode.match(/\.tc_in_cart\s*\{[^}]*\}/g);
    if (cssSection) {
      cssSection.forEach((rule: string) => {
        expect(rule).not.toContain("display: none");
        expect(rule).not.toContain("display:none");
      });
    }
  });

  it("WordPress plugin has push notification endpoints", async () => {
    const fs = await import("fs");
    const pluginCode = fs.readFileSync(
      "/home/ubuntu/ticketbylamako-app/scripts/lamako-mobile-api.php",
      "utf-8",
    );

    // Should have register-push-token endpoint
    expect(pluginCode).toContain("register-push-token");

    // Should have Expo push notification sending logic
    expect(pluginCode).toContain("exp.host");
    expect(pluginCode).toContain("ExponentPushToken");
  });
});

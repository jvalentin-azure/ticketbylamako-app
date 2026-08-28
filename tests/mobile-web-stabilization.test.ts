import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { goBackOrFallback } from "../lib/navigation";
import * as WebNotifications from "../lib/notification-runtime.web";

const source = (path: string) => readFileSync(resolve(path), "utf8");

function themeLightColor(name: string): string {
  const match = source("theme.config.js").match(
    new RegExp(`${name}:\\s*\\{\\s*light:\\s*['\"]([^'\"]+)`),
  );
  if (!match) throw new Error(`Missing light theme color: ${name}`);
  return match[1];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex
      .replace("#", "")
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3)
      throw new Error(`Invalid hex: ${hex}`);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

afterEach(async () => {
  await WebNotifications.cancelAllScheduledNotificationsAsync();
  vi.useRealTimers();
});

describe("mobile web stabilization", () => {
  it("delivers immediate in-app notifications to the web notification center", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const subscription =
      WebNotifications.addNotificationReceivedListener(listener);

    const identifier = await WebNotifications.scheduleNotificationAsync({
      identifier: "payment-confirmed-42",
      content: {
        title: "Paiement confirmé",
        body: "Commande #42",
        data: { type: "payment_confirmed", orderId: 42 },
      },
      trigger: null,
    });
    await vi.runAllTimersAsync();

    expect(identifier).toBe("payment-confirmed-42");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].request.content.data).toEqual({
      type: "payment_confirmed",
      orderId: 42,
    });
    subscription.remove();
  });

  it("shows new web notifications in an accessible foreground banner", () => {
    const layout = source("app/_layout.tsx");
    const banner = source("components/foreground-notification-banner.tsx");
    const provider = source("lib/notifications-provider.tsx");
    const paymentReturn = source("hooks/use-payment-return.ts");
    const notifications = source("lib/notifications.ts");

    expect(layout).toContain("<ForegroundNotificationBanner />");
    expect(provider).toContain("setForegroundNotification(next)");
    expect(banner).toContain('accessibilityLiveRegion="polite"');
    expect(banner).toContain('document.addEventListener("visibilitychange"');
    expect(banner).toContain("notificationDestinationForAuth");
    expect(paymentReturn).toContain("notifyPaymentConfirmed(");
    expect(notifications).toContain(
      "identifier: `payment-confirmed-${orderId}`",
    );
    expect(notifications).toContain(
      'data: { type: "payment_confirmed", orderId }',
    );
  });

  it("cancels web reminders before delivery", async () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const subscription =
      WebNotifications.addNotificationReceivedListener(listener);
    const identifier = await WebNotifications.scheduleNotificationAsync({
      content: { title: "Rappel" },
      trigger: {
        type: WebNotifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 60_000),
      } as never,
    });

    await WebNotifications.cancelScheduledNotificationAsync(identifier);
    await vi.runAllTimersAsync();

    expect(listener).not.toHaveBeenCalled();
    subscription.remove();
  });

  it("uses a fallback only when router history is unavailable", () => {
    const withHistory = {
      canGoBack: vi.fn(() => true),
      back: vi.fn(),
      replace: vi.fn(),
    };
    goBackOrFallback(withHistory as never, "/(tabs)/events", false);
    expect(withHistory.back).toHaveBeenCalledOnce();
    expect(withHistory.replace).not.toHaveBeenCalled();

    const directEntry = {
      canGoBack: vi.fn(() => false),
      back: vi.fn(),
      replace: vi.fn(),
    };
    goBackOrFallback(directEntry as never, "/(tabs)/events", false);
    expect(directEntry.back).not.toHaveBeenCalled();
    expect(directEntry.replace).toHaveBeenCalledWith("/(tabs)/events");

    const syntheticWebHistory = {
      canGoBack: vi.fn(() => true),
      back: vi.fn(),
      replace: vi.fn(),
    };
    goBackOrFallback(syntheticWebHistory as never, "/(tabs)/events", true);
    expect(syntheticWebHistory.back).not.toHaveBeenCalled();
    expect(syntheticWebHistory.replace).toHaveBeenCalledWith("/(tabs)/events");
  });

  it("renders a real Google Maps iframe on web", () => {
    const map = source("components/maps/embedded-google-map.web.tsx");
    expect(map).toContain("<iframe");
    expect(map).toContain("www.google.com/maps?q=");
    expect(map).toContain('referrerPolicy="no-referrer-when-downgrade"');
  });

  it("keeps event category filters in their own non-growing row", () => {
    const events = source("app/(tabs)/events.tsx");
    expect(events).toContain("style={styles.categoryScroller}");
    expect(events).toContain("flexGrow: 0");
    expect(events).toContain("flexShrink: 0");
  });

  it("offers the shared Apple, Facebook and Google choices at login and signup", () => {
    const social = source("components/auth/social-auth-buttons.tsx");
    const login = source("app/(auth)/login.tsx");
    const register = source("app/(auth)/register.tsx");
    expect(social).toContain("Continuer avec Apple");
    expect(social).toContain("Continuer avec Facebook");
    expect(social).toContain("Continuer avec Google");
    expect(login).toContain("<SocialAuthButtons");
    expect(register).toContain("<SocialAuthButtons");
  });

  it("allows only same-origin mobile web OAuth callbacks", () => {
    const plugin = source("scripts/lamako-mobile-api.php");
    expect(plugin).toContain("parsed.origin === window.location.origin");
    expect(plugin).toContain(
      "/^\\/mobile\\/oauth\\/(google|facebook)-callback\\/?$/i",
    );
  });

  it("uses one explicit Raleway family across payment confirmation text", () => {
    const paymentReturn = source("app/payment-return.tsx");
    expect(paymentReturn).toContain('fontFamily: "Raleway_800ExtraBold"');
    expect(paymentReturn).toContain('fontFamily: "Raleway_500Medium"');
    expect(paymentReturn).not.toContain('fontWeight: "700"');
    expect(paymentReturn).not.toContain('fontWeight: "800"');
  });

  it("keeps light-theme payment copy readable on cards and pages", () => {
    const muted = themeLightColor("muted");
    expect(
      contrastRatio(muted, themeLightColor("surface")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(muted, themeLightColor("background")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(source("components/payment/payment-screen.styles.ts")).not.toContain(
      "fontWeight",
    );
  });

  it("loads every Raleway weight referenced by the payment experience", () => {
    const layout = source("app/_layout.tsx");
    expect(layout).toContain("useFonts({");
    expect(layout).toContain("Raleway_500Medium");
    expect(layout).toContain("Raleway_600SemiBold");
    expect(layout).toContain("Raleway_700Bold");
    expect(layout).toContain("Raleway_800ExtraBold");
  });
});

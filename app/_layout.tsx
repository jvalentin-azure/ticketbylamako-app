import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-provider";
import { CartProvider } from "@/lib/cart-provider";
import { RewardsProvider } from "@/lib/rewards-provider";
import { FavoritesProvider } from "@/lib/favorites-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
// System font used - no custom font loading
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { trpc, createTRPCClient } from "@/lib/trpc";
import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";
import { CustomSplash } from "@/components/splash-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { RewardsPopup } from "@/components/rewards-popup";
import { GlobalCartHoldBanner } from "@/components/global-cart-hold-banner";
import {
  setupNotificationHandler,
  setupAndroidChannel,
} from "@/lib/notifications";
import { NotificationsProvider } from "@/lib/notifications-provider";
import {
  notificationDestinationForAuth,
  notificationTargetFromData,
  type NotificationTarget,
} from "@/lib/notification-navigation";
import * as Notifications from "expo-notifications";

// Set up notification handler at module level (before any component renders)
try {
  setupNotificationHandler();
} catch (e) {
  console.warn("Notification handler setup failed:", e);
}

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };
const ONBOARDING_STORAGE_KEY = "@ticketbylamako/onboarding-version";
const ONBOARDING_VERSION = "2";

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

function NotificationNavigationHandler() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();
  const handledNotificationIds = useRef(new Set<string>());
  const [pendingTarget, setPendingTarget] = useState<NotificationTarget | null>(
    null,
  );

  useEffect(() => {
    if (Platform.OS === "web") return;

    const queueNotification = (
      response: Notifications.NotificationResponse,
    ) => {
      const identifier = response.notification.request.identifier;
      if (handledNotificationIds.current.has(identifier)) return;
      handledNotificationIds.current.add(identifier);

      const target = notificationTargetFromData(
        response.notification.request.content.data,
      );
      if (target) setPendingTarget(target);
    };

    void setupAndroidChannel().catch((error) => {
      console.warn("Android channel setup failed:", error);
    });
    const subscription =
      Notifications.addNotificationResponseReceivedListener(queueNotification);

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        queueNotification(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingTarget || !rootNavigationState?.key || isLoading) return;

    const destination = notificationDestinationForAuth(
      pendingTarget,
      isAuthenticated,
    );

    router.push(destination as any);
    setPendingTarget(null);
  }, [
    isAuthenticated,
    isLoading,
    pendingTarget,
    rootNavigationState?.key,
    router,
  ]);

  return null;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // System font is used - no custom font loading needed
  const fontsLoaded = true;
  const fontError = null;

  const [showSplash, setShowSplash] = useState<boolean | null>(null); // null = checking auth state

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Onboarding is a first-use experience, independent from authentication.
  // Session validation belongs to AuthProvider and must not block app startup.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    let isMounted = true;

    (async () => {
      try {
        const storedVersion = await AsyncStorage.getItem(
          ONBOARDING_STORAGE_KEY,
        );
        if (isMounted) {
          setShowSplash(storedVersion !== ONBOARDING_VERSION);
        }
      } catch (err) {
        console.warn("[Onboarding] Unable to read completion state:", err);
        if (isMounted) setShowSplash(true);
      } finally {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [fontsLoaded, fontError]);

  const handleOnboardingFinish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION);
    } catch (err) {
      console.warn("[Onboarding] Unable to save completion state:", err);
    } finally {
      setShowSplash(false);
    }
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  // Don't render until fonts are loaded and auth check is done
  // Show branded loading screen instead of blank white screen
  if (!fontsLoaded && !fontError) {
    return <LoadingScreen />;
  }

  // Still checking auth state - show branded loading screen
  if (showSplash === null) {
    return <LoadingScreen />;
  }

  if (showSplash && fontsLoaded) {
    return (
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        <ThemeProvider>
          <CustomSplash onFinish={handleOnboardingFinish} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NotificationNavigationHandler />
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(auth)"
              options={{ presentation: "fullScreenModal" }}
            />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="ticket/[id]" />
            <Stack.Screen
              name="checkout"
              options={{
                presentation: "modal",
                statusBarHidden: false,
                statusBarStyle: "dark",
              }}
            />
            <Stack.Screen
              name="payment-return"
              options={{
                presentation: "fullScreenModal",
                gestureEnabled: false,
                statusBarHidden: false,
                statusBarStyle: "dark",
              }}
            />
            <Stack.Screen
              name="payment"
              options={{
                presentation: "modal",
                statusBarHidden: false,
                statusBarStyle: "dark",
              }}
            />
            <Stack.Screen name="orders" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="privacy-data" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="legal-notice" />
            <Stack.Screen name="help" />
            <Stack.Screen name="rewards" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="search" />
            <Stack.Screen name="about" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="notification-settings" />
            <Stack.Screen name="oauth/callback" />
            <Stack.Screen name="oauth/google-callback" />
            <Stack.Screen name="oauth/facebook-callback" />
            <Stack.Screen name="oauth/google_callback" />
            <Stack.Screen name="oauth/facebook_callback" />
          </Stack>
          <StatusBar style="auto" />
          <GlobalCartHoldBanner />
          <RewardsPopup delay={30000} />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <RewardsProvider>
              <FavoritesProvider>
                <NotificationsProvider>
                  <SafeAreaProvider initialMetrics={providerInitialMetrics}>
                    <SafeAreaFrameContext.Provider value={frame}>
                      <SafeAreaInsetsContext.Provider value={insets}>
                        {content}
                      </SafeAreaInsetsContext.Provider>
                    </SafeAreaFrameContext.Provider>
                  </SafeAreaProvider>
                </NotificationsProvider>
              </FavoritesProvider>
            </RewardsProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <RewardsProvider>
            <FavoritesProvider>
              <NotificationsProvider>
                <SafeAreaProvider>{content}</SafeAreaProvider>
              </NotificationsProvider>
            </FavoritesProvider>
          </RewardsProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

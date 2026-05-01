import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider } from "@/lib/auth-provider";
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
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { CustomSplash } from "@/components/splash-screen";
import { RewardsPopup } from "@/components/rewards-popup";
import { setupNotificationHandler, registerForPushNotificationsAsync, setupAndroidChannel, registerPushTokenWithBackend } from "@/lib/notifications";
import { NotificationsProvider } from "@/lib/notifications-provider";
import * as Notifications from "expo-notifications";
import { router as expoRouter } from "expo-router";

// Set up notification handler at module level (before any component renders)
setupNotificationHandler();

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

// Prevent splash screen from auto-hiding while fonts load
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Load Raleway fonts
  const [fontsLoaded, fontError] = useFonts({
    "Raleway-Regular": require("@/assets/fonts/Raleway-Regular.ttf"),
    "Raleway-Medium": require("@/assets/fonts/Raleway-Medium.ttf"),
    "Raleway-SemiBold": require("@/assets/fonts/Raleway-SemiBold.ttf"),
    "Raleway-Bold": require("@/assets/fonts/Raleway-Bold.ttf"),
    "Raleway-ExtraBold": require("@/assets/fonts/Raleway-ExtraBold.ttf"),
  });

  const [showSplash, setShowSplash] = useState<boolean | null>(null); // null = checking auth state

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Set up push notifications
  useEffect(() => {
    if (Platform.OS === "web") return;
    setupAndroidChannel();
    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        // Register with WordPress backend
        try {
          const { getStoredUser } = await import("@/lib/api/auth");
          const user = await getStoredUser();
          registerPushTokenWithBackend(user?.id);
        } catch (e) {
          console.warn("Push token backend registration failed:", e);
        }
      }
    });

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification received:", notification.request.content.title);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === "event_reminder" && data?.eventId) {
        expoRouter.push(`/event/${data.eventId}` as any);
      }
      if (data?.type === "order_update" && data?.orderId) {
        expoRouter.push(`/order/${data.orderId}` as any);
      }
      if (data?.type === "new_event" && data?.eventId) {
        expoRouter.push(`/event/${data.eventId}` as any);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Decide whether to show onboarding intro screens.
  // The onboarding is shown on EVERY launch unless the user is logged in with a valid token.
  // This ensures new users always see the intro, and returning logged-in users skip it.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    (async () => {
      try {
        const AsyncStorageModule = (await import("@react-native-async-storage/async-storage")).default;
        const { getStoredUser, getStoredToken, validateToken } = await import("@/lib/api/auth");

        // Check if user has a valid session
        const user = await getStoredUser();
        const token = await getStoredToken();

        if (user && token) {
          // User data + token exist - validate token is still valid
          const isValid = await validateToken();
          if (isValid) {
            // Token is valid, user is truly logged in - skip onboarding
            console.log("[Onboarding] User logged in with valid token, skipping onboarding");
            setShowSplash(false);
            SplashScreen.hideAsync();
            return;
          }
        }

        // No valid session - always show onboarding
        console.log("[Onboarding] No valid session, showing onboarding");
        setShowSplash(true);
        setTimeout(() => SplashScreen.hideAsync(), 50);
      } catch (err) {
        // On error (network etc), show onboarding to be safe
        console.log("[Onboarding] Error during auth check, showing onboarding:", err);
        setShowSplash(true);
        setTimeout(() => SplashScreen.hideAsync(), 50);
      }
    })();
  }, [fontsLoaded, fontError]);

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
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
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
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Still checking auth state - keep native splash visible
  if (showSplash === null) {
    return null;
  }

  if (showSplash && fontsLoaded) {
    return (
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        <ThemeProvider>
          <CustomSplash onFinish={() => setShowSplash(false)} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="ticket/[id]" />
            <Stack.Screen name="checkout" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="orders" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="help" />
            <Stack.Screen name="rewards" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="search" />
            <Stack.Screen name="about" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
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
                  <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
                </NotificationsProvider>
              </FavoritesProvider>
            </RewardsProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

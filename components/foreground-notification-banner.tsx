import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import {
  notificationDestinationForAuth,
  notificationTargetFromData,
} from "@/lib/notification-navigation";
import { useNotifications } from "@/lib/notifications-provider";

const DISPLAY_DURATION_MS = 6000;
const ENTER_DURATION_MS = 180;
const EXIT_DURATION_MS = 140;

export function ForegroundNotificationBanner() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { foregroundNotification, dismissForegroundNotification, markAsRead } =
    useNotifications();
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingMs = useRef(DISPLAY_DURATION_MS);
  const timerStartedAt = useRef(0);

  const clearDismissTimer = useCallback(() => {
    if (!dismissTimer.current) return;
    clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion ? 80 : EXIT_DURATION_MS,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: reduceMotion ? 0 : -10,
        duration: reduceMotion ? 80 : EXIT_DURATION_MS,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(dismissForegroundNotification);
  }, [
    clearDismissTimer,
    dismissForegroundNotification,
    opacity,
    reduceMotion,
    translateY,
  ]);

  const startDismissTimer = useCallback(() => {
    clearDismissTimer();
    timerStartedAt.current = Date.now();
    dismissTimer.current = setTimeout(dismiss, remainingMs.current);
  }, [clearDismissTimer, dismiss]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!foregroundNotification) return;

    remainingMs.current = DISPLAY_DURATION_MS;
    opacity.setValue(0);
    translateY.setValue(reduceMotion ? 0 : -24);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 80 : ENTER_DURATION_MS,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion ? 80 : ENTER_DURATION_MS,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        remainingMs.current = Math.max(
          0,
          remainingMs.current - (Date.now() - timerStartedAt.current),
        );
        clearDismissTimer();
      } else {
        startDismissTimer();
      }
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      if (!document.hidden) startDismissTimer();
    } else {
      startDismissTimer();
    }

    return () => {
      clearDismissTimer();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [
    clearDismissTimer,
    foregroundNotification?.id,
    opacity,
    reduceMotion,
    startDismissTimer,
    translateY,
  ]);

  if (Platform.OS !== "web" || !foregroundNotification) return null;

  const target = notificationTargetFromData(foregroundNotification.data);
  const openNotification = () => {
    markAsRead(foregroundNotification.id);
    dismissForegroundNotification();
    const destination = target
      ? notificationDestinationForAuth(target, isAuthenticated)
      : "/notifications";
    router.push(destination as never);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { top: Math.max(insets.top, 8) + 8 }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderLeftColor: colors.primary,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${foregroundNotification.title}. ${foregroundNotification.body}. ${target?.actionLabel || "Ouvrir les notifications"}`}
          activeOpacity={0.88}
          onPress={openNotification}
          style={styles.content}
        >
          <View
            style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}
          >
            <IconSymbol name="bell.fill" size={20} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {foregroundNotification.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.body, { color: colors.muted }]}
            >
              {foregroundNotification.body}
            </Text>
            <Text style={[styles.action, { color: colors.primary }]}>
              {target?.actionLabel || "Ouvrir les notifications"}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Fermer la notification"
          activeOpacity={0.7}
          onPress={dismiss}
          style={styles.close}
        >
          <IconSymbol name="xmark" size={18} color={colors.muted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 100000,
    elevation: 24,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  banner: {
    width: "100%",
    maxWidth: 520,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  content: {
    flex: 1,
    minHeight: 92,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 4,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    marginLeft: 11,
    paddingRight: 4,
  },
  title: {
    fontFamily: "Raleway_700Bold",
    fontSize: 14,
    lineHeight: 18,
  },
  body: {
    fontFamily: "Raleway_500Medium",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  action: {
    fontFamily: "Raleway_700Bold",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
  },
  close: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});

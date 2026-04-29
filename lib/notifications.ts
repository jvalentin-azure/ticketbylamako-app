import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_KEY = "tbl_push_token";
const NOTIFICATION_PREFS_KEY = "tbl_notification_prefs";

export interface NotificationPreferences {
  newEvents: boolean;
  orderUpdates: boolean;
  eventReminders: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  newEvents: true,
  orderUpdates: true,
  eventReminders: true,
  promotions: true,
};

/**
 * Configure the notification handler for foreground notifications
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Set up Android notification channel
 */
export async function setupAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "TicketByLamako",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#663d17",
    });

    await Notifications.setNotificationChannelAsync("events", {
      name: "Événements",
      description: "Notifications pour les nouveaux événements",
      importance: Notifications.AndroidImportance.HIGH,
    });

    await Notifications.setNotificationChannelAsync("orders", {
      name: "Commandes",
      description: "Mises à jour de vos commandes",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

/**
 * Register for push notifications and return the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Set up Android channel first
  await setupAndroidChannel();

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  try {
    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const token = tokenData.data;

    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch (error) {
    console.warn("Failed to get push token:", error);
    return null;
  }
}

/**
 * Register the Expo push token with the WordPress backend.
 * Should be called after login or whenever the token changes.
 */
export async function registerPushTokenWithBackend(userId?: number): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) {
      // Try to get a new token first
      const newToken = await registerForPushNotificationsAsync();
      if (!newToken) return false;
    }
    const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!storedToken) return false;

    const { registerPushToken } = await import("@/lib/api/woocommerce");
    const result = await registerPushToken(
      storedToken,
      userId,
      Platform.OS
    );
    return result.success;
  } catch (error) {
    console.warn("Failed to register push token with backend:", error);
    return false;
  }
}

/**
 * Get stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (data) return { ...DEFAULT_PREFS, ...JSON.parse(data) };
  } catch {}
  return DEFAULT_PREFS;
}

/**
 * Save notification preferences
 */
export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Schedule event reminders (24h before AND 1h before)
 */
export async function scheduleEventReminder(eventId: number, eventName: string, eventDate: Date): Promise<string | null> {
  try {
    const now = new Date();
    let lastId: string | null = null;

    // Schedule reminder 24 hours before event
    const reminder24h = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > now) {
      lastId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Rappel : demain !",
          body: `${eventName} a lieu demain. Préparez-vous !`,
          data: { type: "event_reminder", eventId },
          ...(Platform.OS === "android" ? { channelId: "events" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder24h,
        },
      });
    }

    // Schedule reminder 1 hour before event
    const reminder1h = new Date(eventDate.getTime() - 60 * 60 * 1000);
    if (reminder1h > now) {
      lastId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Rappel d'événement",
          body: `${eventName} commence dans 1 heure !`,
          data: { type: "event_reminder", eventId },
          ...(Platform.OS === "android" ? { channelId: "events" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder1h,
        },
      });
    }

    return lastId;
  } catch (error) {
    console.warn("Failed to schedule event reminder:", error);
    return null;
  }
}

/**
 * Send a local notification for a new event
 */
export async function notifyNewEvent(eventName: string, eventId: number): Promise<void> {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.newEvents) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nouvel événement 🎉",
        body: `${eventName} vient d'être ajouté ! Découvrez-le maintenant.`,
        data: { type: "new_event", eventId },
        ...(Platform.OS === "android" ? { channelId: "events" } : {}),
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.warn("Failed to send new event notification:", error);
  }
}

/**
 * Send a local notification for payment confirmation
 */
export async function notifyPaymentConfirmed(orderId: number, amount?: string): Promise<void> {
  try {
    const prefs = await getNotificationPreferences();
    if (!prefs.orderUpdates) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Paiement confirmé ✅",
        body: amount
          ? `Votre commande #${orderId} (${amount}) a été payée avec succès.`
          : `Votre commande #${orderId} a été payée avec succès.`,
        data: { type: "order_update", orderId },
        ...(Platform.OS === "android" ? { channelId: "orders" } : {}),
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.warn("Failed to send payment confirmation notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

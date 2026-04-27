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
 * Schedule a local notification (e.g., event reminder)
 */
export async function scheduleEventReminder(eventId: number, eventName: string, eventDate: Date): Promise<string | null> {
  try {
    // Schedule reminder 1 hour before event
    const reminderDate = new Date(eventDate.getTime() - 60 * 60 * 1000);
    
    // Don't schedule if reminder time has already passed
    if (reminderDate <= new Date()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rappel d'événement",
        body: `${eventName} commence dans 1 heure !`,
        data: { type: "event_reminder", eventId },
        ...(Platform.OS === "android" ? { channelId: "events" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    return id;
  } catch (error) {
    console.warn("Failed to schedule event reminder:", error);
    return null;
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

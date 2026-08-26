export type { Notification, NotificationResponse } from "expo-notifications";

const emptySubscription = { remove: () => {} };

export const AndroidImportance = {
  MAX: 5,
  HIGH: 4,
} as const;

export const SchedulableTriggerInputTypes = {
  DATE: "date",
} as const;

export function setNotificationHandler(): void {}

export async function setNotificationChannelAsync(): Promise<null> {
  return null;
}

export async function getPermissionsAsync() {
  return {
    status: "undetermined" as const,
    granted: false,
    canAskAgain: false,
    expires: "never" as const,
  };
}

export async function requestPermissionsAsync() {
  return getPermissionsAsync();
}

export async function getExpoPushTokenAsync() {
  return { data: "" };
}

export function addNotificationReceivedListener() {
  return emptySubscription;
}

export function addNotificationResponseReceivedListener() {
  return emptySubscription;
}

export async function getLastNotificationResponseAsync(): Promise<null> {
  return null;
}

export async function clearLastNotificationResponseAsync(): Promise<void> {}

export async function scheduleNotificationAsync(): Promise<string> {
  return "";
}

export async function cancelScheduledNotificationAsync(): Promise<void> {}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {}

export async function getAllScheduledNotificationsAsync(): Promise<never[]> {
  return [];
}

export async function getBadgeCountAsync(): Promise<number> {
  return 0;
}

export async function setBadgeCountAsync(): Promise<boolean> {
  return false;
}

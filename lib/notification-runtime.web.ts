import type {
  Notification,
  NotificationContentInput,
  NotificationRequest,
  NotificationRequestInput,
  NotificationResponse,
  NotificationTrigger,
} from "expo-notifications";

export type { Notification, NotificationResponse } from "expo-notifications";

type Subscription = { remove: () => void };
type NotificationListener = (notification: Notification) => void;
type ResponseListener = (response: NotificationResponse) => void;

const receivedListeners = new Set<NotificationListener>();
const responseListeners = new Set<ResponseListener>();
const scheduled = new Map<
  string,
  { request: NotificationRequest; timeout: ReturnType<typeof setTimeout> }
>();
let nextIdentifier = 0;
const MAX_TIMEOUT_MS = 2_147_000_000;

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

export function addNotificationReceivedListener(
  listener: NotificationListener,
): Subscription {
  receivedListeners.add(listener);
  return { remove: () => receivedListeners.delete(listener) };
}

export function addNotificationResponseReceivedListener(
  listener: ResponseListener,
): Subscription {
  responseListeners.add(listener);
  return { remove: () => responseListeners.delete(listener) };
}

export async function getLastNotificationResponseAsync(): Promise<null> {
  return null;
}

export async function clearLastNotificationResponseAsync(): Promise<void> {}

function normalizeContent(content: NotificationContentInput) {
  return {
    title: content.title ?? null,
    subtitle: content.subtitle ?? null,
    body: content.body ?? null,
    data: content.data ?? {},
    categoryIdentifier: content.categoryIdentifier ?? null,
    sound: null,
    badge: content.badge ?? null,
    attachments: content.attachments ?? [],
    launchImageName: content.launchImageName ?? null,
    threadIdentifier: null,
  } as Notification["request"]["content"];
}

function triggerDate(trigger: NotificationRequestInput["trigger"]): number {
  if (!trigger) return Date.now();
  if ("type" in trigger && trigger.type === "date") {
    return new Date(trigger.date).getTime();
  }
  return Date.now();
}

function deliver(request: NotificationRequest) {
  scheduled.delete(request.identifier);
  const notification: Notification = {
    date: Date.now(),
    request,
  };
  receivedListeners.forEach((listener) => listener(notification));
}

function armNotification(request: NotificationRequest, deliverAt: number) {
  const remaining = Math.max(0, deliverAt - Date.now());
  const timeout = setTimeout(
    () => {
      if (deliverAt > Date.now()) {
        armNotification(request, deliverAt);
        return;
      }
      deliver(request);
    },
    Math.min(remaining, MAX_TIMEOUT_MS),
  );
  scheduled.set(request.identifier, { request, timeout });
}

export async function scheduleNotificationAsync(
  input: NotificationRequestInput,
): Promise<string> {
  const identifier =
    input.identifier || `web-notification-${Date.now()}-${nextIdentifier++}`;
  const request: NotificationRequest = {
    identifier,
    content: normalizeContent(input.content),
    trigger: input.trigger as NotificationTrigger,
  };
  armNotification(request, triggerDate(input.trigger));
  return identifier;
}

export async function cancelScheduledNotificationAsync(
  identifier: string,
): Promise<void> {
  const entry = scheduled.get(identifier);
  if (!entry) return;
  clearTimeout(entry.timeout);
  scheduled.delete(identifier);
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  scheduled.forEach(({ timeout }) => clearTimeout(timeout));
  scheduled.clear();
}

export async function getAllScheduledNotificationsAsync(): Promise<
  NotificationRequest[]
> {
  return [...scheduled.values()].map(({ request }) => request);
}

export async function getBadgeCountAsync(): Promise<number> {
  return 0;
}

export async function setBadgeCountAsync(): Promise<boolean> {
  return false;
}

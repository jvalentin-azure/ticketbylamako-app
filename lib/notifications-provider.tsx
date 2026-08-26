import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import * as Notifications from "@/lib/notification-runtime";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  mergeStoredNotification,
  notificationTypeIsEnabled,
  notificationStorageKey,
  normalizeStoredNotifications,
  type AppNotification,
} from "./notification-store";
import { getNotificationPreferences } from "./notifications";
import { useAuth } from "./auth-provider";

const LEGACY_NOTIFICATION_STORAGE_KEY = "tbl_notifications";

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isHydrated: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
  archiveRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  isHydrated: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  archiveNotification: () => {},
  archiveRead: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const storageKey = useMemo(
    () => notificationStorageKey(user?.id),
    [user?.id],
  );

  // Load stored notifications on mount
  useEffect(() => {
    let mounted = true;
    setNotifications([]);
    setIsHydrated(false);
    void (async () => {
      try {
        const data = await AsyncStorage.getItem(storageKey);
        if (!mounted || !data) return;
        const stored = normalizeStoredNotifications(JSON.parse(data));
        setNotifications((current) =>
          normalizeStoredNotifications([...current, ...stored]),
        );
      } catch {
        await AsyncStorage.removeItem(storageKey).catch(() => undefined);
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    void AsyncStorage.removeItem(LEGACY_NOTIFICATION_STORAGE_KEY);
    return () => {
      mounted = false;
    };
  }, [storageKey]);

  // Save notifications to storage whenever they change
  const persist = useCallback(
    (notifs: AppNotification[]) => {
      AsyncStorage.setItem(storageKey, JSON.stringify(notifs)).catch(() => {});
    },
    [storageKey],
  );

  const storeNotification = useCallback(
    (notification: Notifications.Notification, read: boolean) => {
      const content = notification.request.content;
      const next: AppNotification = {
        id: notification.request.identifier,
        title: content.title || "Notification",
        body: content.body || "",
        data: content.data as Record<string, unknown> | undefined,
        receivedAt: new Date().toISOString(),
        read,
      };
      setNotifications((previous) => {
        const updated = mergeStoredNotification(previous, next);
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  // Listen for incoming notifications
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        void getNotificationPreferences(user?.id).then((preferences) => {
          if (
            notificationTypeIsEnabled(
              notification.request.content.data?.type,
              preferences,
            )
          ) {
            storeNotification(notification, false);
          }
        });
      },
    );
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        storeNotification(response.notification, true);
      });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [storeNotification, user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        );
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      persist(updated);
      return updated;
    });
  }, [persist]);

  const archiveNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.filter((notification) => notification.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist],
  );

  const archiveRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.filter((notification) => !notification.read);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isHydrated,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        archiveRead,
        clearAll,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

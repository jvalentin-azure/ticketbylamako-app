import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  normalizeStoredNotifications,
  type AppNotification,
} from "./notification-store";

const NOTIF_STORAGE_KEY = "tbl_notifications";
const MAX_NOTIFICATIONS = 50;

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load stored notifications on mount
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(NOTIF_STORAGE_KEY).then((data) => {
      if (!mounted || !data) return;
      let stored: AppNotification[] = [];
      try {
        stored = normalizeStoredNotifications(JSON.parse(data));
      } catch {
        void AsyncStorage.removeItem(NOTIF_STORAGE_KEY);
        return;
      }
      setNotifications((current) => normalizeStoredNotifications([...current, ...stored]));
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Save notifications to storage whenever they change
  const persist = useCallback((notifs: AppNotification[]) => {
    AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs)).catch(() => {});
  }, []);

  // Listen for incoming notifications
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const content = notification.request.content;
      const newNotif: AppNotification = {
        id: notification.request.identifier,
        title: content.title || "Notification",
        body: content.body || "",
        data: content.data as Record<string, unknown> | undefined,
        receivedAt: new Date().toISOString(),
        read: false,
      };

      setNotifications(prev => {
        const updated = normalizeStoredNotifications([newNotif, ...prev]);
        persist(updated);
        return updated;
      });
    });

    return () => subscription.remove();
  }, [persist]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    AsyncStorage.removeItem(NOTIF_STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

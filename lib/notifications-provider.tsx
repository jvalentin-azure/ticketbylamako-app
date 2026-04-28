import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const NOTIF_STORAGE_KEY = "tbl_notifications";
const MAX_NOTIFICATIONS = 50;

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: string; // ISO date string
  read: boolean;
}

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
    AsyncStorage.getItem(NOTIF_STORAGE_KEY).then(data => {
      if (data) {
        try {
          setNotifications(JSON.parse(data));
        } catch {}
      }
    });
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
        data: content.data as Record<string, any> | undefined,
        receivedAt: new Date().toISOString(),
        read: false,
      };

      setNotifications(prev => {
        const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
        persist(updated);
        return updated;
      });
    });

    return () => subscription.remove();
  }, [persist]);

  const unreadCount = notifications.filter(n => !n.read).length;

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

import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  useNotifications,
  type AppNotification,
} from "@/lib/notifications-provider";

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHr < 24) return `Il y a ${diffHr}h`;
    if (diffDay < 7) return `Il y a ${diffDay}j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const handleNotifPress = (notif: AppNotification) => {
    markAsRead(notif.id);
    // Navigate based on notification type
    if (notif.data?.type === "event_reminder" && notif.data?.eventId) {
      router.push(`/event/${notif.data.eventId}` as any);
    } else if (notif.data?.type === "new_event" && notif.data?.eventId) {
      router.push(`/event/${notif.data.eventId}` as any);
    } else if (notif.data?.type === "order_update" && notif.data?.orderId) {
      router.push(`/order/${notif.data.orderId}` as any);
    }
  };

  const renderNotif = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      onPress={() => handleNotifPress(item)}
      style={[
        styles.notifItem,
        {
          backgroundColor: item.read ? colors.background : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.notifIcon,
          {
            backgroundColor: item.read ? colors.surface : colors.primary + "20",
          },
        ]}
      >
        <IconSymbol
          name={
            item.data?.type === "event_reminder"
              ? "clock"
              : item.data?.type === "new_event"
                ? "star.fill"
                : item.data?.type === "order_update"
                  ? "bag.fill"
                  : "bell.fill"
          }
          size={18}
          color={item.read ? colors.muted : colors.primary}
        />
      </View>
      <View style={styles.notifContent}>
        <Text
          style={[
            styles.notifTitle,
            { color: colors.foreground, fontWeight: item.read ? "500" : "700" },
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.notifBody, { color: colors.muted }]}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text style={[styles.notifTime, { color: colors.muted }]}>
          {formatTime(item.receivedAt)}
        </Text>
      </View>
      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>
            Retour
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Notifications
        </Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Tout lire
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push("/notification-settings" as any)}
            style={[styles.settingsBtn, { backgroundColor: colors.surface }]}
          >
            <IconSymbol name="gearshape.fill" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <IconSymbol name="bell.fill" size={40} color={colors.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune notification
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Vous recevrez ici les rappels d'événements, les mises à jour de
            commandes et les nouveautés.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotif}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, fontWeight: "600" },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14 },
  notifBody: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});

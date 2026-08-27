import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Alert } from "@/lib/platform-alert";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import {
  notificationSectionLabel,
  notificationType,
  type AppNotification,
} from "@/lib/notification-store";
import {
  notificationDestinationForAuth,
  notificationTargetFromData,
} from "@/lib/notification-navigation";
import { useNotifications } from "@/lib/notifications-provider";

type InboxFilter = "all" | "unread";

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    notifications,
    unreadCount,
    isHydrated,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    archiveRead,
  } = useNotifications();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const readCount = notifications.length - unreadCount;

  const sections = useMemo(() => {
    const grouped = new Map<string, AppNotification[]>([
      ["Aujourd'hui", []],
      ["Cette semaine", []],
      ["Plus tôt", []],
    ]);
    notifications
      .filter((notification) => filter === "all" || !notification.read)
      .forEach((notification) => {
        grouped
          .get(notificationSectionLabel(notification.receivedAt))
          ?.push(notification);
      });
    return [...grouped.entries()]
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [filter, notifications]);

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

  const notificationAccent = (item: AppNotification) => {
    const type = notificationType(item);
    if (type === "payment_confirmed" || type === "ticket_ready") {
      return colors.success;
    }
    if (type === "event_reminder") return colors.warning;
    if (type === "promotion" || type === "promo" || type === "marketing") {
      return "#8B5CF6";
    }
    return colors.primary;
  };

  const handleNotifPress = (notif: AppNotification) => {
    markAsRead(notif.id);
    const target = notificationTargetFromData(notif.data);
    if (target) {
      router.push(
        notificationDestinationForAuth(target, isAuthenticated) as any,
      );
    }
  };

  const confirmArchiveRead = () => {
    Alert.alert(
      "Archiver les notifications lues ?",
      "Elles seront retirées de cette boîte de réception sur cet appareil.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Archiver", onPress: archiveRead },
      ],
    );
  };

  const renderNotif = ({ item }: { item: AppNotification }) => {
    const type = notificationType(item);
    const action = notificationTargetFromData(item.data)?.actionLabel ?? null;
    const accent = notificationAccent(item);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${item.read ? "Notification lue" : "Nouvelle notification"}. ${item.title}. ${item.body}`}
        accessibilityHint={action || "Marquer comme lue"}
        onPress={() => handleNotifPress(item)}
        style={[
          styles.notifItem,
          {
            backgroundColor: colors.surface,
            borderColor: item.read ? colors.border : accent + "55",
          },
        ]}
        activeOpacity={0.74}
      >
        <View style={[styles.notifAccent, { backgroundColor: accent }]} />
        <View style={[styles.notifIcon, { backgroundColor: accent + "16" }]}>
          <IconSymbol
            name={
              type === "event_reminder"
                ? "clock"
                : type === "new_event"
                  ? "star.fill"
                  : type === "order_update" || type === "payment_confirmed"
                    ? "bag.fill"
                    : type === "ticket_ready"
                      ? "ticket.fill"
                      : "bell.fill"
            }
            size={19}
            color={accent}
          />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text
              style={[
                styles.notifTitle,
                {
                  color: colors.foreground,
                  fontFamily: item.read
                    ? "Raleway_600SemiBold"
                    : "Raleway_800ExtraBold",
                },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {!item.read ? (
              <View style={[styles.unreadDot, { backgroundColor: accent }]} />
            ) : null}
          </View>
          <Text style={[styles.notifBody, { color: colors.muted }]} numberOfLines={3}>
            {item.body}
          </Text>
          <View style={styles.notifMetaRow}>
            <Text style={[styles.notifTime, { color: colors.muted }]}>
              {formatTime(item.receivedAt)}
            </Text>
            {action ? (
              <Text style={[styles.notifAction, { color: accent }]}>{action}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Archiver ${item.title}`}
          onPress={(event) => {
            event.stopPropagation();
            archiveNotification(item.id);
          }}
          style={[styles.archiveButton, { backgroundColor: colors.background }]}
        >
          <IconSymbol name="archivebox.fill" size={18} color={colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.primary + "16" }]}>
          <IconSymbol name="bell.fill" size={24} color={colors.primary} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>VOTRE ACTUALITÉ</Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} à lire`
              : "Vous êtes à jour"}
          </Text>
          <Text style={[styles.summarySubtitle, { color: colors.muted }]}>
            Billets, paiements et rappels d'événements au même endroit.
          </Text>
        </View>
      </View>

      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {(["all", "unread"] as const).map((value) => {
          const selected = filter === value;
          return (
            <TouchableOpacity
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={[styles.segment, selected && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.segmentText, { color: selected ? "#fff" : colors.muted }]}>
                {value === "all"
                  ? `Toutes (${notifications.length})`
                  : `Non lues (${unreadCount})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {unreadCount > 0 || readCount > 0 ? (
        <View style={styles.bulkActions}>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead} style={styles.bulkButton}>
              <IconSymbol name="checkmark.circle.fill" size={17} color={colors.success} />
              <Text style={[styles.bulkText, { color: colors.success }]}>Tout marquer lu</Text>
            </TouchableOpacity>
          ) : null}
          {readCount > 0 ? (
            <TouchableOpacity onPress={confirmArchiveRead} style={styles.bulkButton}>
              <IconSymbol name="archivebox.fill" size={17} color={colors.muted} />
              <Text style={[styles.bulkText, { color: colors.muted }]}>Archiver les lues</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>Centre d'information</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Paramètres des notifications"
          onPress={() => router.push("/notification-settings" as any)}
          style={[styles.headerButton, { backgroundColor: colors.surface }]}
        >
          <IconSymbol name="gearshape.fill" size={19} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {!isHydrated ? (
        <View accessibilityLabel="Chargement des notifications" style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Chargement de vos notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "12" }]}>
            <IconSymbol name="bell.fill" size={38} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Vous êtes à jour</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Les confirmations de commande, billets et rappels apparaîtront ici.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)" as any)}
            style={[styles.emptyAction, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.emptyActionText}>Découvrir les événements</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderNotif}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.filteredEmpty}>
              <IconSymbol name="checkmark.circle.fill" size={30} color={colors.success} />
              <Text style={[styles.filteredEmptyTitle, { color: colors.foreground }]}>Aucune notification non lue</Text>
              <Text style={[styles.filteredEmptyText, { color: colors.muted }]}>Tout est traité pour le moment.</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: colors.muted, backgroundColor: colors.background }]}>
              {section.title}
            </Text>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Raleway_800ExtraBold" },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontFamily: "Raleway_500Medium" },
  listContent: { paddingBottom: 28 },
  summary: { margin: 16, marginBottom: 12, borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  summaryIcon: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontFamily: "Raleway_800ExtraBold" },
  summaryTitle: { marginTop: 3, fontSize: 17, fontFamily: "Raleway_800ExtraBold" },
  summarySubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17, fontFamily: "Raleway_500Medium" },
  segmented: { marginHorizontal: 16, padding: 4, borderRadius: 8, flexDirection: "row" },
  segment: { flex: 1, minHeight: 40, borderRadius: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentText: { fontSize: 12, fontFamily: "Raleway_700Bold" },
  bulkActions: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 14 },
  bulkButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 6 },
  bulkText: { fontSize: 12, fontFamily: "Raleway_700Bold" },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 11, fontFamily: "Raleway_800ExtraBold" },
  notifItem: { marginHorizontal: 16, marginBottom: 8, minHeight: 102, borderWidth: 1, borderRadius: 8, padding: 13, paddingLeft: 16, flexDirection: "row", alignItems: "flex-start", gap: 11, overflow: "hidden" },
  notifAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  notifIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
  notifBody: { marginTop: 4, fontSize: 12, lineHeight: 18, fontFamily: "Raleway_500Medium" },
  notifMetaRow: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notifTime: { fontSize: 10, fontFamily: "Raleway_600SemiBold" },
  notifAction: { fontSize: 11, fontFamily: "Raleway_800ExtraBold" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  archiveButton: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, fontSize: 13, fontFamily: "Raleway_500Medium" },
  emptyIcon: { width: 72, height: 72, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 20, fontFamily: "Raleway_800ExtraBold", marginBottom: 8 },
  emptySubtitle: { maxWidth: 300, fontSize: 14, textAlign: "center", lineHeight: 20, fontFamily: "Raleway_500Medium" },
  emptyAction: { minHeight: 48, marginTop: 20, paddingHorizontal: 20, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyActionText: { color: "#fff", fontSize: 14, fontFamily: "Raleway_800ExtraBold" },
  filteredEmpty: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 44 },
  filteredEmptyTitle: { marginTop: 12, fontSize: 16, fontFamily: "Raleway_800ExtraBold" },
  filteredEmptyText: { marginTop: 5, fontSize: 13, fontFamily: "Raleway_500Medium" },
});

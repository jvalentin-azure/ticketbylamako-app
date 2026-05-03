import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCustomerOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatDateShort, decodeHtmlEntities } from "@/lib/format";

interface TicketItem {
  orderId: number;
  ticketCode: string;
  eventName: string;
  ticketType: string;
  date: string;
  status: string;
}

export default function TicketsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const orders = await getCustomerOrders(user.id);
      const tix: TicketItem[] = [];
      for (const order of orders) {
        for (const item of order.line_items) {
          const codeMeta = item.meta_data?.find((m: any) => m.key === "Ticket Code" || m.key === "ticket_code" || m.key === "_tc_ticket_code");
          tix.push({
            orderId: order.id,
            ticketCode: codeMeta?.value || `TKT-${order.id}-${item.id}`,
            eventName: decodeHtmlEntities(item.name),
            ticketType: item.meta_data?.find((m: any) => m.key === "Ticket Type" || m.key === "_tc_ticket_type_name")?.value || "Standard",
            date: order.date_created,
            status: order.status,
          });
        }
      }
      setTickets(tix);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center px-6">
        <IconSymbol name="ticket.fill" size={64} color={colors.muted} />
        <Text style={[styles.loginTitle, { color: colors.foreground }]}>Mes Billets</Text>
        <Text style={[styles.loginSub, { color: colors.muted }]}>Connectez-vous pour voir vos billets et QR codes</Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login" as any)}
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const statusColor = (s: string) => {
    if (s === "completed" || s === "processing") return colors.success;
    if (s === "pending" || s === "on-hold") return colors.warning;
    return colors.error;
  };

  const statusLabel = (s: string) => {
    if (s === "completed") return "Validé";
    if (s === "processing") return "Actif";
    if (s === "pending") return "En attente";
    if (s === "on-hold") return "En attente";
    if (s === "cancelled") return "Annulé";
    if (s === "refunded") return "Remboursé";
    return s;
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mes Billets</Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item, i) => `${item.orderId}-${i}`}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/ticket/${item.orderId}` as any)}
              style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.ticketIcon, { backgroundColor: colors.primary + "15" }]}>
                <IconSymbol name="ticket.fill" size={24} color={colors.primary} />
              </View>
              <View style={styles.ticketInfo}>
                <Text style={[styles.ticketName, { color: colors.foreground }]} numberOfLines={1}>{item.eventName}</Text>
                <Text style={[styles.ticketMeta, { color: colors.muted }]}>{item.ticketType} - {formatDateShort(item.date)}</Text>
              </View>
              <View style={styles.ticketRight}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} style={{ marginTop: 6 }} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun billet trouvé</Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>Vos billets apparaîtront ici après achat</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  ticketCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  ticketIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ticketInfo: { flex: 1, marginLeft: 12 },
  ticketName: { fontSize: 15, fontWeight: "600" },
  ticketMeta: { fontSize: 12, marginTop: 2 },
  ticketRight: { alignItems: "flex-end" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, marginTop: 12 },
  emptySubText: { fontSize: 13, marginTop: 4 },
  loginTitle: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  loginSub: { fontSize: 14, textAlign: "center", marginTop: 8 },
  loginBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 20 },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

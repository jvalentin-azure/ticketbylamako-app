import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCustomerOrders, type WCOrder } from "@/lib/api/woocommerce";
import { formatDateShort } from "@/lib/format";

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
            eventName: item.name,
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
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <IconSymbol name="ticket.fill" size={64} color={colors.muted} />
        <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700", marginTop: 16 }}>Mes Billets</Text>
        <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>Connectez-vous pour voir vos billets et QR codes</Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login" as any)}
          style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 20 }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Se connecter</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const statusColor = (s: string) => {
    if (s === "completed" || s === "processing") return colors.success;
    if (s === "pending" || s === "on-hold") return colors.warning;
    return colors.error;
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Mes Billets</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
              style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                <IconSymbol name="ticket.fill" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{item.eventName}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.ticketType} - {formatDateShort(item.date)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ backgroundColor: statusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: "600" }}>
                    {item.status === "completed" ? "Validé" : item.status === "processing" ? "Actif" : item.status}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} style={{ marginTop: 6 }} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 15, marginTop: 12 }}>Aucun billet trouvé</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Vos billets apparaîtront ici après achat</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

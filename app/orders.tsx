import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getMobileOrders } from "@/lib/api/mobile";
import { mobileOrderToWCOrder } from "@/lib/order-adapters";
import type { WCOrder } from "@/lib/types/commerce";
import { formatAriary, formatDate, decodeHtmlEntities } from "@/lib/format";

const statusMap: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: "Terminée", color: "#22C55E", icon: "checkmark.circle.fill" },
  processing: { label: "En cours", color: "#F59E0B", icon: "clock.fill" },
  "on-hold": { label: "En attente", color: "#6366F1", icon: "pause.circle.fill" },
  pending: { label: "En attente paiement", color: "#6366F1", icon: "pause.circle.fill" },
  cancelled: { label: "Annulée", color: "#EF4444", icon: "xmark.circle.fill" },
  refunded: { label: "Remboursée", color: "#8B5CF6", icon: "arrow.uturn.left.circle.fill" },
  failed: { label: "Échouée", color: "#EF4444", icon: "xmark.circle.fill" },
};

/**
 * Extract ticket codes from order meta_data (tc_cart_info).
 * Returns an array of { ticketType, seat, code } for each ticket in the order.
 */
function extractTicketInfo(order: WCOrder): { ticketType: string; seat: string; code: string }[] {
  const tickets: { ticketType: string; seat: string; code: string }[] = [];
  const cartInfo = order.meta_data?.find(m => m.key === "tc_cart_info")?.value;
  if (cartInfo && typeof cartInfo === "object") {
    for (const [code, info] of Object.entries(cartInfo as Record<string, any>)) {
      tickets.push({
        ticketType: info.ticket_type_title || info.ticket_type || "",
        seat: info.seat || "",
        code: code,
      });
    }
  }
  return tickets;
}

function OrderCard({ order, colors, onPress }: { order: WCOrder; colors: any; onPress: () => void }) {
  const st = statusMap[order.status] || { label: order.status, color: colors.muted, icon: "questionmark.circle" };
  const ticketInfo = extractTicketInfo(order);
  const totalTickets = ticketInfo.length;
  const paymentMethod = order.payment_method_title || "Non spécifié";

  return (
    <TouchableOpacity onPress={onPress} style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.7}>
      {/* Header: Order number + Status */}
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.orderNumber, { color: colors.foreground }]}>Commande #{order.number || order.id}</Text>
          <Text style={[styles.orderDate, { color: colors.muted }]}>{formatDate(order.date_created)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.color + "15" }]}>
          <IconSymbol name={st.icon as any} size={12} color={st.color} />
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {/* Line Items */}
      <View style={[styles.lineItemsSection, { borderTopColor: colors.border }]}>
        {order.line_items.map((li, i) => (
          <View key={i} style={styles.lineItem}>
            <View style={[styles.lineItemQty, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.lineItemQtyText, { color: colors.primary }]}>{li.quantity}x</Text>
            </View>
            <Text style={[styles.lineItemName, { color: colors.foreground }]} numberOfLines={2}>{decodeHtmlEntities(li.name)}</Text>
            <Text style={[styles.lineItemPrice, { color: colors.foreground }]}>{formatAriary(li.total)}</Text>
          </View>
        ))}
      </View>

      {/* Tickets count */}
      {totalTickets > 0 && (
        <View style={[styles.ticketsRow, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
          <IconSymbol name="ticket.fill" size={14} color={colors.primary} />
          <Text style={[styles.ticketsText, { color: colors.primary }]}>
            {totalTickets} billet{totalTickets > 1 ? "s" : ""} associé{totalTickets > 1 ? "s" : ""}
          </Text>
          {ticketInfo.some(t => t.seat) && (
            <Text style={[styles.seatsText, { color: colors.muted }]}>
              Sièges: {ticketInfo.filter(t => t.seat).map(t => t.seat).join(", ")}
            </Text>
          )}
        </View>
      )}

      {/* Footer: Payment + Total */}
      <View style={[styles.orderFooter, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.paymentLabel, { color: colors.muted }]}>Paiement</Text>
          <Text style={[styles.paymentValue, { color: colors.foreground }]}>{paymentMethod}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.totalLabel, { color: colors.muted }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>{formatAriary(order.total)}</Text>
        </View>
      </View>

      {/* View details arrow */}
      <View style={styles.viewDetails}>
        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Voir les détails</Text>
        <IconSymbol name="chevron.right" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<WCOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getMobileOrders({ limit: 50 })
      .then(o => {
        if (!cancelled) setOrders(o.map(mobileOrderToWCOrder));
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="person.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16 }}>Connectez-vous pour voir vos commandes</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mes Commandes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary bar */}
      {!loading && orders.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: colors.foreground }]}>{orders.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Commande{orders.length > 1 ? "s" : ""}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: "#22C55E" }]}>{orders.filter(o => o.status === "completed").length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Terminée{orders.filter(o => o.status === "completed").length > 1 ? "s" : ""}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: "#F59E0B" }]}>{orders.filter(o => ["processing", "on-hold", "pending"].includes(o.status)).length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>En cours</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>Chargement des commandes...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <IconSymbol name="clipboard.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16 }}>Aucune commande</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>Vos commandes apparaîtront ici après votre premier achat.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: order }) => (
            <OrderCard
              order={order}
              colors={colors}
              onPress={() => router.push(`/order/${order.id}` as any)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  summaryBar: { flexDirection: "row", paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNumber: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, marginVertical: 4 },
  orderCard: { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  orderHeader: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: "700" },
  orderDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "600" },
  lineItemsSection: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  lineItem: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  lineItemQty: { width: 32, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 10 },
  lineItemQtyText: { fontSize: 12, fontWeight: "700" },
  lineItemName: { flex: 1, fontSize: 13 },
  lineItemPrice: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  ticketsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexWrap: "wrap" },
  ticketsText: { fontSize: 12, fontWeight: "600" },
  seatsText: { fontSize: 11 },
  orderFooter: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  paymentLabel: { fontSize: 11 },
  paymentValue: { fontSize: 13, fontWeight: "600" },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 18, fontWeight: "800" },
  viewDetails: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderTopWidth: 0 },
  viewDetailsText: { fontSize: 13, fontWeight: "600" },
});

import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getOrder, getOrderTickets, extractTicketsFromOrder, type WCOrder, type TicketInstance } from "@/lib/api/woocommerce";
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

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const [order, setOrder] = useState<WCOrder | null>(null);
  const [tickets, setTickets] = useState<TicketInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const o = await getOrder(Number(id));
        setOrder(o);
        // Try mobile API first for real ticket codes
        const apiTickets = await getOrderTickets(Number(id));
        if (apiTickets && apiTickets.tickets.length > 0) {
          setTickets(apiTickets.tickets);
        } else {
          // Fallback: extract from order meta
          setTickets(extractTicketsFromOrder(o));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted, fontFamily: "Raleway-Medium" }}>Commande introuvable</Text>
      </ScreenContainer>
    );
  }

  const st = statusMap[order.status] || { label: order.status, color: colors.muted, icon: "questionmark.circle" };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Commande #{order.number || order.id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: st.color + "10" }]}>
          <IconSymbol name={st.icon as any} size={24} color={st.color} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.statusTitle, { color: st.color }]}>{st.label}</Text>
            <Text style={[styles.statusDate, { color: colors.muted }]}>
              {order.date_paid ? `Payée le ${formatDate(order.date_paid)}` : `Créée le ${formatDate(order.date_created)}`}
            </Text>
          </View>
        </View>

        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Récapitulatif</Text>
          
          {order.line_items.map((li, i) => (
            <View key={i} style={[styles.lineItem, i < order.line_items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineItemName, { color: colors.foreground }]}>{decodeHtmlEntities(li.name)}</Text>
                <Text style={[styles.lineItemMeta, { color: colors.muted }]}>
                  Quantité: {li.quantity} × {formatAriary(String(parseFloat(li.total) / li.quantity))}
                </Text>
                {li.sku ? <Text style={[styles.lineItemMeta, { color: colors.muted }]}>SKU: {li.sku}</Text> : null}
              </View>
              <Text style={[styles.lineItemTotal, { color: colors.foreground }]}>{formatAriary(li.total)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={[styles.totalsSection, { borderTopColor: colors.border }]}>
            {order.subtotal && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>Sous-total</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatAriary(order.subtotal)}</Text>
              </View>
            )}
            {order.discount_total && parseFloat(order.discount_total) > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: "#22C55E" }]}>Réduction</Text>
                <Text style={[styles.totalValue, { color: "#22C55E" }]}>-{formatAriary(order.discount_total)}</Text>
              </View>
            )}
            {order.total_tax && parseFloat(order.total_tax) > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>Taxes</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatAriary(order.total_tax)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatAriary(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Paiement</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Méthode</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.payment_method_title || "Non spécifié"}</Text>
            </View>
            {order.transaction_id ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Transaction</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{order.transaction_id}</Text>
              </View>
            ) : null}
            {order.date_paid ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Date de paiement</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDate(order.date_paid)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Billing Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Facturation</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Nom</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.billing.first_name} {order.billing.last_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Email</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.billing.email}</Text>
            </View>
            {order.billing.phone ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Téléphone</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.billing.phone}</Text>
              </View>
            ) : null}
            {order.billing.address_1 ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Adresse</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.billing.address_1}{order.billing.city ? `, ${order.billing.city}` : ""}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Tickets Section - shows ALL tickets individually */}
        {tickets.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitleInline, { color: colors.foreground }]}>Billets ({tickets.length})</Text>
              <TouchableOpacity
                onPress={() => router.push(`/ticket/${order.id}` as any)}
                style={[styles.viewAllBtn, { backgroundColor: colors.primary + "12" }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewAllText, { color: colors.primary }]}>Voir tous</Text>
                <IconSymbol name="chevron.right" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {tickets.map((ticket, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => router.push(`/ticket/${order.id}?ticketCode=${ticket.ticket_code}` as any)}
                style={[styles.ticketCard, { backgroundColor: colors.background, borderColor: colors.border }, i < tickets.length - 1 && { marginBottom: 8 }]}
                activeOpacity={0.7}
              >
                <View style={styles.ticketCardContent}>
                  <View style={[styles.ticketIcon, { backgroundColor: colors.primary + "15" }]}>
                    <IconSymbol name="ticket.fill" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.ticketType, { color: colors.foreground }]}>{decodeHtmlEntities(ticket.product_name)}</Text>
                    {ticket.seat_label ? (
                      <Text style={[styles.ticketSeat, { color: colors.primary }]}>Siège {ticket.seat_label}</Text>
                    ) : null}
                    <Text style={[styles.ticketCodeText, { color: colors.muted }]}>{ticket.ticket_code}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.ticketPrice, { color: colors.foreground }]}>{formatAriary(String(ticket.price))}</Text>
                    <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Customer Note */}
        {order.customer_note ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Note</Text>
            <Text style={[styles.noteText, { color: colors.muted }]}>{order.customer_note}</Text>
          </View>
        ) : null}

        {/* Order Meta */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Informations</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>N° commande</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>#{order.number || order.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Date de création</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDate(order.date_created)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Devise</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.currency || "MGA"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Raleway-Bold" },
  statusBanner: { flexDirection: "row", alignItems: "center", padding: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 14 },
  statusTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  statusDate: { fontSize: 12, marginTop: 2, fontFamily: "Raleway-Regular" },
  section: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontFamily: "Raleway-Bold" },
  sectionTitleInline: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  viewAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  viewAllText: { fontSize: 12, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  lineItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  lineItemName: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  lineItemMeta: { fontSize: 12, marginTop: 2, fontFamily: "Raleway-Regular" },
  lineItemTotal: { fontSize: 14, fontWeight: "700", marginLeft: 12, fontFamily: "Raleway-Bold" },
  totalsSection: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  totalLabel: { fontSize: 13, fontFamily: "Raleway-Medium" },
  totalValue: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  grandTotalLabel: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  grandTotalValue: { fontSize: 20, fontWeight: "800", fontFamily: "Raleway-Bold" },
  infoGrid: { paddingHorizontal: 16, paddingBottom: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  infoLabel: { fontSize: 13, fontFamily: "Raleway-Medium", flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold", flex: 1, textAlign: "right" },
  ticketCard: { borderRadius: 12, borderWidth: 1, marginHorizontal: 16, marginBottom: 4 },
  ticketCardContent: { flexDirection: "row", alignItems: "center", padding: 14 },
  ticketIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ticketType: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  ticketSeat: { fontSize: 13, marginTop: 2, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  ticketCodeText: { fontSize: 11, marginTop: 1, fontFamily: "Raleway-Regular" },
  ticketPrice: { fontSize: 13, fontWeight: "700", fontFamily: "Raleway-Bold" },
  noteText: { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16, fontFamily: "Raleway-Regular" },
});

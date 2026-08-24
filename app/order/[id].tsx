import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getMobileOrder,
  getMobileOrderTickets,
  MobileApiError,
} from "@/lib/api/mobile";
import {
  mobileOrderToWCOrder,
  mobileTicketToTicketInstance,
} from "@/lib/order-adapters";
import type { WCOrder, TicketInstance } from "@/lib/types/commerce";
import { orderAllowsTicketDisplay } from "@/lib/order-access";
import { formatAriary, formatDate, decodeHtmlEntities } from "@/lib/format";

const statusMap: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  completed: {
    label: "Terminée",
    color: "#22C55E",
    icon: "checkmark.circle.fill",
  },
  "cs-complete": {
    label: "Terminée",
    color: "#22C55E",
    icon: "checkmark.circle.fill",
  },
  processing: {
    label: "Payée · billets disponibles",
    color: "#16A34A",
    icon: "checkmark.circle.fill",
  },
  "on-hold": {
    label: "En attente",
    color: "#6366F1",
    icon: "pause.circle.fill",
  },
  pending: {
    label: "En attente paiement",
    color: "#6366F1",
    icon: "pause.circle.fill",
  },
  cancelled: { label: "Annulée", color: "#EF4444", icon: "xmark.circle.fill" },
  refunded: {
    label: "Remboursée",
    color: "#8B5CF6",
    icon: "arrow.uturn.left.circle.fill",
  },
  failed: { label: "Échouée", color: "#EF4444", icon: "xmark.circle.fill" },
};

function orderDetailErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    if (error.status === 401)
      return "Votre session a expiré. Reconnectez-vous puis réessayez.";
    if (error.status === 403)
      return "Votre compte ne peut pas accéder à cette commande.";
    if (error.status === 404) return "Cette commande est introuvable.";
    if (error.status === 408)
      return "La connexion est trop lente. Réessayez dans un instant.";
  }
  return "Impossible de charger cette commande pour le moment.";
}

function OrderDetailSkeleton({ color }: { color: string }) {
  return (
    <View
      accessibilityLabel="Chargement de la commande"
      style={styles.skeletonPage}
    >
      <View style={[styles.skeletonBanner, { backgroundColor: color }]} />
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[styles.skeletonSection, { borderColor: color }]}
        >
          <View style={[styles.skeletonTitle, { backgroundColor: color }]} />
          <View style={[styles.skeletonLine, { backgroundColor: color }]} />
          <View
            style={[styles.skeletonLineShort, { backgroundColor: color }]}
          />
        </View>
      ))}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const [order, setOrder] = useState<WCOrder | null>(null);
  const [tickets, setTickets] = useState<TicketInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (orderId: number, activeRequest: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const mobileOrder = await getMobileOrder(orderId);
      if (requestId.current !== activeRequest) return;

      const nextOrder = mobileOrderToWCOrder(mobileOrder);
      setOrder(nextOrder);
      if (orderAllowsTicketDisplay(mobileOrder)) {
        const ticketResponse = await getMobileOrderTickets(orderId);
        if (requestId.current !== activeRequest) return;
        setTickets(ticketResponse.tickets.map(mobileTicketToTicketInstance));
      } else {
        setTickets([]);
      }
    } catch (error) {
      if (requestId.current === activeRequest) {
        setOrder(null);
        setTickets([]);
        setErrorMessage(orderDetailErrorMessage(error));
      }
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const orderId = Number(id);
    const activeRequest = ++requestId.current;
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setLoading(false);
      setErrorMessage("Cette commande est introuvable.");
      return;
    }
    void load(orderId, activeRequest);
    return () => {
      if (requestId.current === activeRequest) requestId.current += 1;
    };
  }, [id, load]);

  if (loading) {
    return (
      <ScreenContainer>
        <OrderDetailSkeleton color={colors.border} />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer>
        <View style={styles.errorState}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: colors.warning + "12" },
            ]}
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={34}
              color={colors.warning}
            />
          </View>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Commande indisponible
          </Text>
          <Text style={[styles.errorCopy, { color: colors.muted }]}>
            {errorMessage || "Cette commande est introuvable."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              const orderId = Number(id);
              if (Number.isFinite(orderId) && orderId > 0) {
                const activeRequest = ++requestId.current;
                void load(orderId, activeRequest);
              }
            }}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color="#fff" />
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.primary }]}>
              Revenir à mes commandes
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const effectiveStatus =
    order.payment_status === "success" ? "processing" : order.status;
  const st = statusMap[effectiveStatus] || {
    label: order.status,
    color: colors.muted,
    icon: "questionmark.circle",
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Commande #{order.number || order.id}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View
          style={[styles.statusBanner, { backgroundColor: st.color + "10" }]}
        >
          <IconSymbol name={st.icon as any} size={24} color={st.color} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.statusTitle, { color: st.color }]}>
              {st.label}
            </Text>
            <Text style={[styles.statusDate, { color: colors.muted }]}>
              {order.date_paid
                ? `Payée le ${formatDate(order.date_paid)}`
                : `Créée le ${formatDate(order.date_created)}`}
            </Text>
          </View>
        </View>

        {tickets.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push(`/ticket/${order.id}` as any)}
            style={[
              styles.ticketPrimaryAction,
              { backgroundColor: colors.primary },
            ]}
          >
            <IconSymbol name="ticket.fill" size={18} color="#fff" />
            <Text style={styles.ticketPrimaryActionText}>
              Voir{" "}
              {tickets.length > 1
                ? `mes ${tickets.length} billets`
                : "mon billet"}
            </Text>
            <IconSymbol name="chevron.right" size={16} color="#fff" />
          </TouchableOpacity>
        ) : null}

        {/* Order Summary */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Récapitulatif
          </Text>

          {order.line_items.map((li, i) => (
            <View
              key={i}
              style={[
                styles.lineItem,
                i < order.line_items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.lineItemName, { color: colors.foreground }]}
                >
                  {decodeHtmlEntities(li.name)}
                </Text>
                <Text style={[styles.lineItemMeta, { color: colors.muted }]}>
                  Quantité: {li.quantity} ×{" "}
                  {formatAriary(String(parseFloat(li.total) / li.quantity))}
                </Text>
                {li.sku ? (
                  <Text style={[styles.lineItemMeta, { color: colors.muted }]}>
                    SKU: {li.sku}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[styles.lineItemTotal, { color: colors.foreground }]}
              >
                {formatAriary(li.total)}
              </Text>
            </View>
          ))}

          {/* Totals */}
          <View
            style={[styles.totalsSection, { borderTopColor: colors.border }]}
          >
            {order.subtotal && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>
                  Sous-total
                </Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>
                  {formatAriary(order.subtotal)}
                </Text>
              </View>
            )}
            {order.discount_total && parseFloat(order.discount_total) > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: "#22C55E" }]}>
                  Réduction
                </Text>
                <Text style={[styles.totalValue, { color: "#22C55E" }]}>
                  -{formatAriary(order.discount_total)}
                </Text>
              </View>
            )}
            {order.total_tax && parseFloat(order.total_tax) > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.muted }]}>
                  Taxes
                </Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>
                  {formatAriary(order.total_tax)}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.totalRow,
                {
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.grandTotalLabel, { color: colors.foreground }]}
              >
                Total
              </Text>
              <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
                {formatAriary(order.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Paiement
          </Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Méthode
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {order.payment_method_title || "Non spécifié"}
              </Text>
            </View>
            {order.transaction_id ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>
                  Transaction
                </Text>
                <Text
                  style={[styles.infoValue, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {order.transaction_id}
                </Text>
              </View>
            ) : null}
            {order.date_paid ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>
                  Date de paiement
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {formatDate(order.date_paid)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Billing Info */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Facturation
          </Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Nom
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {order.billing.first_name} {order.billing.last_name}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Email
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {order.billing.email}
              </Text>
            </View>
            {order.billing.phone ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>
                  Téléphone
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {order.billing.phone}
                </Text>
              </View>
            ) : null}
            {order.billing.address_1 ? (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>
                  Adresse
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {order.billing.address_1}
                  {order.billing.city ? `, ${order.billing.city}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Tickets Section - shows ALL tickets individually */}
        {tickets.length > 0 && (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitleInline,
                  { color: colors.foreground },
                ]}
              >
                Billets ({tickets.length})
              </Text>
              <TouchableOpacity
                onPress={() => router.push(`/ticket/${order.id}` as any)}
                style={[
                  styles.viewAllBtn,
                  { backgroundColor: colors.primary + "12" },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewAllText, { color: colors.primary }]}>
                  Voir tous
                </Text>
                <IconSymbol
                  name="chevron.right"
                  size={12}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
            {tickets.map((ticket, i) => (
              <TouchableOpacity
                key={i}
                onPress={() =>
                  router.push(
                    `/ticket/${order.id}?ticketCode=${ticket.ticket_code}` as any,
                  )
                }
                style={[
                  styles.ticketCard,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                  i < tickets.length - 1 && { marginBottom: 8 },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.ticketCardContent}>
                  <View
                    style={[
                      styles.ticketIcon,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <IconSymbol
                      name="ticket.fill"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[styles.ticketType, { color: colors.foreground }]}
                    >
                      {decodeHtmlEntities(ticket.product_name)}
                    </Text>
                    {ticket.seat_label ? (
                      <Text
                        style={[styles.ticketSeat, { color: colors.primary }]}
                      >
                        Siège {ticket.seat_label}
                      </Text>
                    ) : null}
                    <Text
                      style={[styles.ticketCodeText, { color: colors.muted }]}
                    >
                      {ticket.ticket_code}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text
                      style={[styles.ticketPrice, { color: colors.foreground }]}
                    >
                      {formatAriary(String(ticket.price))}
                    </Text>
                    <IconSymbol
                      name="chevron.right"
                      size={14}
                      color={colors.muted}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Customer Note */}
        {order.customer_note ? (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Note
            </Text>
            <Text style={[styles.noteText, { color: colors.muted }]}>
              {order.customer_note}
            </Text>
          </View>
        ) : null}

        {/* Order Meta */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Informations
          </Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                N° commande
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                #{order.number || order.id}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Date de création
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {formatDate(order.date_created)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Devise
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {order.currency || "MGA"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
  },
  statusTitle: { fontSize: 16, fontWeight: "700" },
  statusDate: { fontSize: 12, marginTop: 2 },
  ticketPrimaryAction: {
    minHeight: 50,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  ticketPrimaryActionText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitleInline: { fontSize: 15, fontWeight: "700" },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewAllText: { fontSize: 12, fontWeight: "600" },
  lineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lineItemName: { fontSize: 14, fontWeight: "600" },
  lineItemMeta: { fontSize: 12, marginTop: 2 },
  lineItemTotal: { fontSize: 14, fontWeight: "700", marginLeft: 12 },
  totalsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 13, fontWeight: "600" },
  grandTotalLabel: { fontSize: 15, fontWeight: "700" },
  grandTotalValue: { fontSize: 20, fontWeight: "800" },
  infoGrid: { paddingHorizontal: 16, paddingBottom: 16 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  ticketCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  ticketCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketType: { fontSize: 14, fontWeight: "600" },
  ticketSeat: { fontSize: 13, marginTop: 2, fontWeight: "600" },
  ticketCodeText: { fontSize: 11, marginTop: 1 },
  ticketPrice: { fontSize: 13, fontWeight: "700" },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  skeletonPage: { paddingTop: 16 },
  skeletonBanner: {
    height: 76,
    borderRadius: 8,
    marginHorizontal: 16,
    opacity: 0.65,
  },
  skeletonSection: {
    height: 132,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  skeletonTitle: { width: "38%", height: 16, borderRadius: 4, opacity: 0.7 },
  skeletonLine: {
    width: "86%",
    height: 13,
    borderRadius: 4,
    opacity: 0.55,
    marginTop: 22,
  },
  skeletonLineShort: {
    width: "58%",
    height: 13,
    borderRadius: 4,
    opacity: 0.45,
    marginTop: 12,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 64,
  },
  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  errorCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 20,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  backLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 4,
  },
  backLinkText: { fontSize: 13, fontWeight: "600" },
});

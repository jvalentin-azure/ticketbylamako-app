import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import {
  getMobileOrders,
  MobileApiError,
  type MobileOrderSummary,
} from "@/lib/api/mobile";
import { CACHE_DURATIONS, getCachedValue, setCache } from "@/lib/api/cache";
import { decodeHtmlEntities, formatAriary, formatDate } from "@/lib/format";
import type { WCOrder } from "@/lib/types/commerce";
import { orderPaymentPresentation } from "@/lib/order-access";

interface OrderListItem extends Pick<WCOrder, "id" | "status" | "total"> {
  number: string;
  dateCreated: string;
  paymentMethodTitle: string;
  ticketCount: number;
  ticketsReady: boolean;
  paymentStatus: MobileOrderSummary["paymentStatus"];
  requiresManualReview: boolean;
  items: Pick<
    WCOrder["line_items"][number],
    "id" | "name" | "quantity" | "total"
  >[];
}

function orderCacheKey(userId: number) {
  return `order-list-v3-${userId}`;
}

function toOrderListItem(order: MobileOrderSummary): OrderListItem {
  return {
    id: order.id,
    number: order.number || String(order.id),
    status: order.status,
    total: order.total,
    dateCreated: order.dateCreated || "",
    paymentMethodTitle: order.paymentMethodTitle || "Non spécifié",
    ticketCount: order.ticketCount || 0,
    ticketsReady: order.ticketsReady === true,
    paymentStatus: order.paymentStatus,
    requiresManualReview: order.requiresManualReview === true,
    items: (order.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      total: item.total,
    })),
  };
}

function orderErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    if (error.status === 401)
      return "Votre session a expiré. Reconnectez-vous puis réessayez.";
    if (error.status === 403)
      return "Votre compte ne peut pas accéder à ces commandes.";
    if (error.status === 408)
      return "La connexion est trop lente. Votre historique enregistré reste disponible.";
  }
  return "Impossible d'actualiser vos commandes pour le moment.";
}

function OrderListSkeleton({ color }: { color: string }) {
  return (
    <View
      accessibilityLabel="Chargement de vos commandes"
      style={styles.skeletonList}
    >
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.skeletonCard, { borderColor: color }]}>
          <View style={[styles.skeletonTitle, { backgroundColor: color }]} />
          <View style={[styles.skeletonLine, { backgroundColor: color }]} />
          <View style={[styles.skeletonTotal, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

function OrderCard({
  order,
  colors,
  onPress,
}: {
  order: OrderListItem;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  const presentation = orderPaymentPresentation(order as MobileOrderSummary);
  const toneColor =
    presentation.tone === "success"
      ? "#22C55E"
      : presentation.tone === "warning"
        ? "#F59E0B"
        : presentation.tone === "danger"
          ? "#EF4444"
          : colors.muted;
  const status = {
    label: presentation.label,
    color: toneColor,
    icon:
      presentation.tone === "success"
        ? "checkmark.circle.fill"
        : presentation.tone === "danger"
          ? "xmark.circle.fill"
          : "clock.fill",
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la commande ${order.number}`}
      onPress={onPress}
      style={[
        styles.orderCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      activeOpacity={0.78}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderHeading}>
          <Text style={[styles.orderNumber, { color: colors.foreground }]}>
            Commande #{order.number}
          </Text>
          <Text style={[styles.orderDate, { color: colors.muted }]}>
            {formatDate(order.dateCreated)}
          </Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: `${status.color}15` }]}
        >
          <IconSymbol
            name={status.icon as any}
            size={12}
            color={status.color}
          />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {order.items.length > 0 ? (
        <View
          style={[styles.lineItemsSection, { borderTopColor: colors.border }]}
        >
          {order.items.map((item) => (
            <View key={`${order.id}-${item.id}`} style={styles.lineItem}>
              <View
                style={[
                  styles.lineItemQty,
                  { backgroundColor: `${colors.primary}15` },
                ]}
              >
                <Text
                  style={[styles.lineItemQtyText, { color: colors.primary }]}
                >
                  {item.quantity}x
                </Text>
              </View>
              <Text
                style={[styles.lineItemName, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {decodeHtmlEntities(item.name)}
              </Text>
              <Text
                style={[styles.lineItemPrice, { color: colors.foreground }]}
              >
                {formatAriary(item.total)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {order.ticketsReady && order.ticketCount > 0 ? (
        <View
          style={[
            styles.ticketsRow,
            {
              backgroundColor: `${colors.primary}08`,
              borderColor: `${colors.primary}20`,
            },
          ]}
        >
          <IconSymbol name="ticket.fill" size={14} color={colors.primary} />
          <Text style={[styles.ticketsText, { color: colors.primary }]}>
            {order.ticketCount} billet{order.ticketCount > 1 ? "s" : ""} associé
            {order.ticketCount > 1 ? "s" : ""}
          </Text>
        </View>
      ) : null}

      <View style={[styles.orderFooter, { borderTopColor: colors.border }]}>
        <View style={styles.orderHeading}>
          <Text style={[styles.paymentLabel, { color: colors.muted }]}>
            Paiement
          </Text>
          <Text style={[styles.paymentValue, { color: colors.foreground }]}>
            {order.paymentMethodTitle}
          </Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={[styles.totalLabel, { color: colors.muted }]}>
            Total
          </Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>
            {formatAriary(order.total)}
          </Text>
        </View>
      </View>

      <View style={styles.viewDetails}>
        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
          Voir les détails
        </Text>
        <IconSymbol name="chevron.right" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const requestId = useRef(0);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "success" | "pending" | "failed"
  >("all");

  const load = useCallback(async (userId: number, activeRequest: number) => {
    try {
      const response = await getMobileOrders({ limit: 50 });
      const nextOrders = response.map(toOrderListItem);
      if (requestId.current !== activeRequest) return;
      setOrders(nextOrders);
      setErrorMessage(null);
      await setCache(orderCacheKey(userId), nextOrders);
    } catch (error) {
      if (requestId.current === activeRequest) {
        setErrorMessage(orderErrorMessage(error));
      }
    } finally {
      if (requestId.current === activeRequest) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;
    const activeRequest = ++requestId.current;

    if (!isAuthenticated || !userId) {
      setOrders([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    setOrders([]);
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      const cached = await getCachedValue<OrderListItem[]>(
        orderCacheKey(userId),
        CACHE_DURATIONS.ORDERS,
      );
      if (requestId.current !== activeRequest) return;
      if (cached) {
        setOrders(cached.data);
        setLoading(false);
      }
      await load(userId, activeRequest);
    })();

    return () => {
      if (requestId.current === activeRequest) requestId.current += 1;
    };
  }, [isAuthenticated, load, user?.id]);

  const refresh = useCallback(() => {
    if (!user?.id) return;
    const activeRequest = ++requestId.current;
    setRefreshing(true);
    setErrorMessage(null);
    void load(user.id, activeRequest);
  }, [load, user?.id]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer>
        <View style={styles.centeredState}>
          <IconSymbol name="person.fill" size={48} color={colors.muted} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>
            Connectez-vous pour voir vos commandes
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/login" as any)}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const completedCount = orders.filter(
    (order) => order.paymentStatus === "success",
  ).length;
  const pendingCount = orders.filter(
    (order) =>
      order.paymentStatus === "pending" ||
      order.paymentStatus === "review" ||
      order.requiresManualReview,
  ).length;
  const failedCount = orders.filter((order) =>
    ["failed", "cancelled", "expired"].includes(order.paymentStatus),
  ).length;
  const filteredOrders = orders.filter((order) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "success") return order.paymentStatus === "success";
    if (activeFilter === "failed") {
      return ["failed", "cancelled", "expired"].includes(order.paymentStatus);
    }
    return (
      order.paymentStatus === "pending" ||
      order.paymentStatus === "review" ||
      order.requiresManualReview
    );
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Revenir à l'écran précédent"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Mes commandes
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!loading && orders.length > 0 ? (
        <View style={styles.overview}>
          <Text style={[styles.overviewTitle, { color: colors.foreground }]}>
            Votre activité
          </Text>
          <Text style={[styles.overviewCopy, { color: colors.muted }]}>
            Suivez clairement les paiements confirmés, en vérification ou non
            aboutis.
          </Text>
          <View style={styles.summaryBar}>
            {[
              {
                label: "Toutes",
                value: orders.length,
                tone: colors.foreground,
              },
              { label: "Payées", value: completedCount, tone: "#15803D" },
              { label: "En attente", value: pendingCount, tone: "#B45309" },
              { label: "Échouées", value: failedCount, tone: "#DC2626" },
            ].map((item) => (
              <View
                key={item.label}
                style={[
                  styles.summaryItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.summaryNumber, { color: item.tone }]}>
                  {item.value}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.filters}>
            {[
              ["all", "Toutes"],
              ["success", "Payées"],
              ["pending", "En attente"],
              ["failed", "Échouées"],
            ].map(([key, label]) => {
              const selected = activeFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveFilter(key as typeof activeFilter)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: selected ? "#fff" : colors.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {loading ? (
        <OrderListSkeleton color={colors.border} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(order) => String(order.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            errorMessage && orders.length > 0 ? (
              <View
                style={[
                  styles.inlineError,
                  {
                    backgroundColor: `${colors.warning}12`,
                    borderColor: `${colors.warning}40`,
                  },
                ]}
              >
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={colors.warning}
                />
                <Text
                  style={[styles.inlineErrorText, { color: colors.foreground }]}
                >
                  {errorMessage}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={refresh}
                  hitSlop={8}
                >
                  <IconSymbol
                    name="arrow.clockwise"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              colors={colors}
              onPress={() => router.push(`/order/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centeredState}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: `${colors.primary}12` },
                ]}
              >
                <IconSymbol
                  name={
                    errorMessage
                      ? "exclamationmark.triangle.fill"
                      : "clipboard.fill"
                  }
                  size={36}
                  color={errorMessage ? colors.warning : colors.primary}
                />
              </View>
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>
                {errorMessage
                  ? "Commandes indisponibles"
                  : activeFilter === "all"
                    ? "Aucune commande"
                    : "Aucune commande dans ce statut"}
              </Text>
              <Text style={[styles.stateCopy, { color: colors.muted }]}>
                {errorMessage ||
                  "Vos commandes apparaîtront ici après votre premier achat."}
              </Text>
              {errorMessage ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={refresh}
                  style={[
                    styles.retryButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <IconSymbol name="arrow.clockwise" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
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
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSpacer: { width: 44 },
  summaryBar: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  overview: { paddingHorizontal: 16, paddingBottom: 14 },
  overviewTitle: { fontSize: 18, fontWeight: "800" },
  overviewCopy: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  summaryItem: {
    flex: 1,
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryNumber: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  filterChip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { fontSize: 12, fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  orderCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  orderHeading: { flex: 1 },
  orderNumber: { fontSize: 16, fontWeight: "700" },
  orderDate: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  lineItemsSection: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lineItem: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  lineItemQty: {
    width: 32,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  lineItemQtyText: { fontSize: 12, fontWeight: "700" },
  lineItemName: { flex: 1, fontSize: 13 },
  lineItemPrice: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  ticketsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketsText: { fontSize: 12, fontWeight: "600" },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  paymentLabel: { fontSize: 11 },
  paymentValue: { fontSize: 13, fontWeight: "600" },
  totalBlock: { alignItems: "flex-end" },
  totalLabel: { fontSize: 11 },
  totalValue: { fontSize: 18, fontWeight: "800" },
  viewDetails: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  viewDetailsText: { fontSize: 13, fontWeight: "600" },
  inlineError: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineErrorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 72,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  stateCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 28,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 18,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  skeletonList: { paddingHorizontal: 16, paddingTop: 10 },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  skeletonTitle: { width: "48%", height: 17, borderRadius: 4, opacity: 0.7 },
  skeletonLine: {
    width: "82%",
    height: 13,
    borderRadius: 4,
    opacity: 0.55,
    marginTop: 18,
  },
  skeletonTotal: {
    width: "28%",
    height: 18,
    borderRadius: 4,
    opacity: 0.7,
    marginTop: 20,
    alignSelf: "flex-end",
  },
});

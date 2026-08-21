import { useMemo, useRef, useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getMobileOrders,
  getMobileOrderTickets,
  MobileApiError,
} from "@/lib/api/mobile";
import { CACHE_DURATIONS, getCachedValue, setCache } from "@/lib/api/cache";
import { formatDateShort, decodeHtmlEntities } from "@/lib/format";
import { filterWalletTickets, sortWalletTickets, type TicketWalletFilter } from "@/lib/ticket-wallet";

interface TicketItem {
  key: string;
  instanceId: string;
  orderId: number;
  eventId: number;
  eventName: string;
  ticketType: string;
  date: string;
  endDate?: string;
  status: string;
  seatLabel?: string;
  eventLocation?: string;
}

const ticketVisibleStatuses = new Set([
  "completed",
  "processing",
  "cs-complete",
]);

function cacheKey(userId: number) {
  return `ticket-wallet-v2-${userId}`;
}

function ticketErrorMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    if (error.status === 401)
      return "Votre session a expiré. Reconnectez-vous puis réessayez.";
    if (error.status === 403)
      return "Votre compte ne peut pas accéder à ces billets.";
    if (error.status === 408)
      return "La connexion est trop lente. Vos billets enregistrés restent disponibles.";
  }
  return "Impossible d'actualiser vos billets pour le moment.";
}

function TicketListSkeleton({ color }: { color: string }) {
  return (
    <View
      accessibilityLabel="Chargement de vos billets"
      style={styles.skeletonList}
    >
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.skeletonCard, { borderColor: color }]}>
          <View style={[styles.skeletonIcon, { backgroundColor: color }]} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonTitle, { backgroundColor: color }]} />
            <View style={[styles.skeletonMeta, { backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TicketsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const requestId = useRef(0);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketWalletFilter>("upcoming");

  const load = useCallback(async (userId: number, activeRequest: number) => {
    try {
      const orders = await getMobileOrders({
        status: "completed,processing,cs-complete",
        limit: 50,
        includeTickets: true,
      });
      const visibleOrders = orders.filter(
        (order) =>
          ticketVisibleStatuses.has(order.status) &&
          (order.ticketCount > 0 || order.ticketsReady),
      );
      const ticketGroups = await Promise.all(
        visibleOrders.map(async (order) => {
          try {
            const orderTickets = Array.isArray(order.tickets)
              ? order.tickets
              : (await getMobileOrderTickets(order.id)).tickets;
            return orderTickets.map((ticket, index) => ({
              key: `${order.id}-${ticket.instanceId || `${ticket.eventId}-${index}`}`,
              instanceId: String(ticket.instanceId || ""),
              orderId: order.id,
              eventId: ticket.eventId,
              eventName: decodeHtmlEntities(
                ticket.eventName || ticket.productName,
              ),
              ticketType: decodeHtmlEntities(ticket.productName || "Standard"),
              date: ticket.eventDate || "",
              endDate: ticket.eventEndDate || undefined,
              status: order.status,
              seatLabel: ticket.seatLabel || undefined,
              eventLocation: ticket.eventLocation || undefined,
            }));
          } catch {
            return [];
          }
        }),
      );

      const tix: TicketItem[] = ticketGroups.flat();
      if (tix.length === 0) {
        orders
          .filter(
            (order) =>
              ticketVisibleStatuses.has(order.status) && order.ticketCount > 0,
          )
          .forEach((order) => {
            (order.items || []).forEach((item, index) => {
              tix.push({
                key: `${order.id}-${item.id || index}`,
                instanceId: "",
                orderId: order.id,
                eventId: 0,
                eventName: decodeHtmlEntities(item.name),
                ticketType: "Standard",
                date: "",
                endDate: undefined,
                status: order.status,
              });
            });
          });
      }
      if (requestId.current !== activeRequest) return;
      setTickets(tix);
      setErrorMessage(null);
      await setCache(cacheKey(userId), tix);
    } catch (error) {
      if (requestId.current === activeRequest) {
        setErrorMessage(ticketErrorMessage(error));
      }
    } finally {
      if (requestId.current === activeRequest) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const userId = user?.id;
    const activeRequest = ++requestId.current;

    if (!isAuthenticated || !userId) {
      setTickets([]);
      setLoading(false);
      setErrorMessage(null);
      return undefined;
    }

    setTickets([]);
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      const cached = await getCachedValue<TicketItem[]>(
        cacheKey(userId),
        CACHE_DURATIONS.TICKETS,
      );
      if (requestId.current !== activeRequest) return;
      if (cached) {
        setTickets(cached.data);
        setLoading(false);
      }
      await load(userId, activeRequest);
    })();

    return () => {
      if (requestId.current === activeRequest) requestId.current += 1;
    };
  }, [isAuthenticated, load, user?.id]));

  const refresh = useCallback(() => {
    if (!user?.id) return;
    const activeRequest = ++requestId.current;
    setRefreshing(true);
    setErrorMessage(null);
    void load(user.id, activeRequest);
  }, [load, user?.id]);

  const visibleTickets = useMemo(
    () => sortWalletTickets(filterWalletTickets(tickets, filter), filter) as TicketItem[],
    [filter, tickets],
  );
  const nextTicket = useMemo(
    () => sortWalletTickets(filterWalletTickets(tickets, "upcoming"), "upcoming")[0] as TicketItem | undefined,
    [tickets],
  );
  const openTicket = useCallback((ticket: TicketItem) => {
    router.push({
      pathname: "/ticket/[id]",
      params: { id: String(ticket.orderId), ...(ticket.instanceId ? { ticketId: ticket.instanceId } : {}) },
    } as any);
  }, [router]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer
        edges={["left", "right"]}
        className="flex-1 items-center justify-center px-6"
      >
        <IconSymbol name="ticket.fill" size={64} color={colors.muted} />
        <Text style={[styles.loginTitle, { color: colors.foreground }]}>
          Mes Billets
        </Text>
        <Text style={[styles.loginSub, { color: colors.muted }]}>
          Connectez-vous pour voir vos billets et QR codes
        </Text>
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
    if (s === "completed" || s === "processing" || s === "cs-complete")
      return colors.success;
    if (s === "pending" || s === "on-hold") return colors.warning;
    return colors.error;
  };

  const statusLabel = (s: string) => {
    if (s === "completed") return "Validé";
    if (s === "processing") return "Actif";
    if (s === "cs-complete") return "Validé";
    if (s === "pending") return "En attente";
    if (s === "on-hold") return "En attente";
    if (s === "cancelled") return "Annulé";
    if (s === "refunded") return "Remboursé";
    return s;
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Mes billets
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Vos accès et QR codes, réunis au même endroit.
          </Text>
        </View>
        {!loading && visibleTickets.length > 0 ? (
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.primary + "14" },
            ]}
          >
            <Text style={[styles.countText, { color: colors.primary }]}>
              {visibleTickets.length}
            </Text>
          </View>
        ) : null}
      </View>
      <View accessibilityRole="tablist" style={[styles.filterBar, { borderColor: colors.border }]}>
        {([["upcoming", "À venir"], ["past", "Passés"], ["all", "Tous"]] as const).map(([value, label]) => {
          const selected = filter === value;
          return (
            <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFilter(value)} style={[styles.filterOption, selected && { backgroundColor: colors.primary }]}>
              <Text style={[styles.filterText, { color: selected ? "#fff" : colors.muted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {loading ? (
        <TicketListSkeleton color={colors.border} />
      ) : (
        <FlatList
          data={visibleTickets}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
            {filter === "upcoming" && nextTicket ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Afficher le prochain billet pour ${nextTicket.eventName}`} onPress={() => openTicket(nextTicket)} style={[styles.nextEvent, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <View style={styles.nextEventTop}>
                  <Text style={styles.nextEventEyebrow}>PROCHAIN ÉVÉNEMENT</Text>
                  <IconSymbol name="qrcode" size={22} color="#fff" />
                </View>
                <Text style={styles.nextEventTitle} numberOfLines={2}>{nextTicket.eventName}</Text>
                <Text style={styles.nextEventMeta}>{nextTicket.date ? formatDateShort(nextTicket.date) : "Date à confirmer"}{nextTicket.seatLabel ? ` · Place ${nextTicket.seatLabel}` : ""}</Text>
                <Text style={styles.nextEventAction}>Afficher mon QR code</Text>
              </TouchableOpacity>
            ) : null}
            {errorMessage && visibleTickets.length > 0 ? (
              <View
                style={[
                  styles.inlineError,
                  {
                    backgroundColor: colors.warning + "12",
                    borderColor: colors.warning + "40",
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
            ) : null}
            </>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le billet ${item.ticketType} pour ${item.eventName}`}
              activeOpacity={0.8}
              onPress={() => openTicket(item)}
              style={[
                styles.ticketCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.ticketIcon,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <IconSymbol
                  name="ticket.fill"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.ticketInfo}>
                <Text
                  style={[styles.ticketName, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {item.eventName}
                </Text>
                <Text
                  style={[styles.ticketMeta, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {item.ticketType}{item.date ? ` · ${formatDateShort(item.date)}` : ""}
                </Text>
                {item.seatLabel ? (
                  <Text style={[styles.seatText, { color: colors.primary }]}>
                    Place {item.seatLabel}
                  </Text>
                ) : null}
                {item.eventLocation ? (
                  <Text
                    style={[styles.locationText, { color: colors.muted }]}
                    numberOfLines={1}
                  >
                    {item.eventLocation}
                  </Text>
                ) : null}
              </View>
              <View style={styles.ticketRight}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColor(item.status) },
                    ]}
                  >
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.muted}
                  style={{ marginTop: 6 }}
                />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.primary + "12" },
                ]}
              >
                <IconSymbol
                  name={
                    errorMessage
                      ? "exclamationmark.triangle.fill"
                      : "ticket.fill"
                  }
                  size={36}
                  color={errorMessage ? colors.warning : colors.primary}
                />
              </View>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>
                {errorMessage
                  ? "Billets indisponibles"
                  : "Votre prochain billet sera ici"}
              </Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>
                {errorMessage ||
                  "Après votre achat, retrouvez immédiatement votre accès et son QR code."}
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
                  <Text style={styles.retryText}>Réessayer</Text>
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
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSubtitle: { fontSize: 13, marginTop: 4 },
  filterBar: { marginHorizontal: 16, marginBottom: 14, padding: 3, borderWidth: 1, borderRadius: 8, flexDirection: "row" },
  filterOption: { flex: 1, minHeight: 40, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  filterText: { fontSize: 13, fontWeight: "700" },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 14, fontWeight: "700" },
  listContent: { paddingHorizontal: 16, paddingBottom: 28, flexGrow: 1 },
  nextEvent: { borderRadius: 8, padding: 18, marginBottom: 14, borderWidth: 1 },
  nextEventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nextEventEyebrow: { color: "#fff", fontSize: 11, fontWeight: "800" },
  nextEventTitle: { color: "#fff", fontSize: 20, lineHeight: 25, fontWeight: "800", marginTop: 14 },
  nextEventMeta: { color: "#fff", opacity: 0.82, fontSize: 13, marginTop: 7 },
  nextEventAction: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 18 },
  ticketCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  ticketIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketInfo: { flex: 1, marginLeft: 12 },
  ticketName: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  ticketMeta: { fontSize: 12, marginTop: 2 },
  seatText: { fontSize: 12, fontWeight: "700", marginTop: 5 },
  locationText: { fontSize: 11, marginTop: 3 },
  ticketRight: { alignItems: "flex-end" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },
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
  emptyContainer: {
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
  emptyText: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 18,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  skeletonList: { paddingHorizontal: 16, gap: 10 },
  skeletonCard: {
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonIcon: { width: 46, height: 46, borderRadius: 8, opacity: 0.55 },
  skeletonCopy: { flex: 1, marginLeft: 12, gap: 9 },
  skeletonTitle: { width: "72%", height: 14, borderRadius: 4, opacity: 0.55 },
  skeletonMeta: { width: "48%", height: 10, borderRadius: 4, opacity: 0.4 },
  loginTitle: { fontSize: 20, fontWeight: "700", marginTop: 16 },
  loginSub: { fontSize: 14, textAlign: "center", marginTop: 8 },
  loginBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

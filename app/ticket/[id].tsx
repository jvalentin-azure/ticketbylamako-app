import { useCallback, useEffect, useState, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getMobileOrder,
  getMobileOrderTickets,
  getMobileTicketWalletLink,
  MobileApiError,
} from "@/lib/api/mobile";
import {
  mobileOrderToWCOrder,
  mobileTicketToTicketInstance,
} from "@/lib/order-adapters";
import type { WCOrder, TicketInstance } from "@/lib/types/commerce";
import { orderAllowsTicketDisplay } from "@/lib/order-access";
import { formatAriary, formatDate, decodeHtmlEntities } from "@/lib/format";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/lib/auth-provider";
import {
  getCachedTicketDetail,
  removeCachedTicketDetail,
  setCachedTicketDetail,
} from "@/lib/ticket-detail-cache";
import type {
  MobileOrderSummary,
  MobileOrderTicketsResponse,
} from "@/lib/api/mobile";
import { EmbeddedGoogleMap } from "@/components/maps/embedded-google-map";
import { CatalogImage } from "@/components/catalog-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  addTicketEventToCalendar,
  CalendarPermissionDeniedError,
} from "@/lib/event-calendar";
import { addTicketToNativeWallet } from "@/lib/native-wallet";

const { width: SCREEN_W } = Dimensions.get("window");

const statusMap: Record<string, { label: string; color: string }> = {
  completed: { label: "Billet actif", color: "#22C55E" },
  "cs-complete": { label: "Billet actif", color: "#22C55E" },
  processing: { label: "Actif", color: "#F59E0B" },
  "on-hold": { label: "En attente", color: "#6366F1" },
  pending: { label: "En attente", color: "#6366F1" },
  cancelled: { label: "Annulé", color: "#EF4444" },
  refunded: { label: "Remboursé", color: "#8B5CF6" },
  failed: { label: "Échoué", color: "#EF4444" },
};

function EntryMode({
  ticket,
  order,
  index,
  total,
  onClose,
}: {
  ticket: TicketInstance;
  order: WCOrder;
  index: number;
  total: number;
  onClose: () => void;
}) {
  useKeepAwake("ticket-entry-mode");

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={["top", "right", "bottom", "left"]}
          style={styles.entryScreen}
        >
          <View style={styles.entryHeader}>
            <View>
              <Text style={styles.entryEyebrow}>MODE ENTRÉE</Text>
              <Text style={styles.entryCounter}>
                Billet {index + 1} sur {total}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fermer le mode entrée"
              onPress={onClose}
              style={styles.entryClose}
            >
              <IconSymbol name="xmark" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.entryContent}>
            <Text style={styles.entryEvent} numberOfLines={3}>
              {decodeHtmlEntities(ticket.event_name || ticket.product_name)}
            </Text>
            <Text style={styles.entryType} numberOfLines={2}>
              {decodeHtmlEntities(ticket.product_name)}
            </Text>
            {ticket.seat_label ? (
              <View style={styles.entrySeat}>
                <Text style={styles.entrySeatLabel}>PLACE</Text>
                <Text style={styles.entrySeatValue}>{ticket.seat_label}</Text>
              </View>
            ) : null}
            <View style={styles.entryQr}>
              <QRCode
                value={ticket.ticket_code}
                size={Math.min(SCREEN_W - 96, 280)}
                backgroundColor="#fff"
                color="#000"
              />
            </View>
            <View style={styles.entryReady}>
              <IconSymbol
                name="checkmark.circle.fill"
                size={20}
                color="#59D98E"
              />
              <Text style={styles.entryReadyText}>
                Prêt à être scanné · disponible hors ligne
              </Text>
            </View>
            <Text style={styles.entryOrder}>
              Commande #{order.number || order.id}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function TicketCard({
  ticket,
  order,
  index,
  total,
  colors,
  onOpenEntry,
  showMap,
}: {
  ticket: TicketInstance;
  order: WCOrder;
  index: number;
  total: number;
  colors: any;
  onOpenEntry: () => void;
  showMap: boolean;
}) {
  const st = statusMap[order.status] || {
    label: order.status,
    color: colors.muted,
  };
  const isValid =
    order.payment_status === "success" && order.tickets_ready === true;
  const isCheckedIn = ticket.checked_in === true;
  const qrValue = ticket.ticket_code;
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const walletProviderAvailability =
    Platform.OS === "ios"
      ? ticket.apple_wallet_available
      : ticket.google_wallet_available;
  const walletAvailable =
    Platform.OS !== "web" &&
    isValid &&
    ticket.instance_id > 0 &&
    qrValue.length > 0 &&
    walletProviderAvailability !== false;

  const handleAddToCalendar = async () => {
    if (calendarBusy) return;
    setCalendarBusy(true);
    try {
      const result = await addTicketEventToCalendar({
        title: decodeHtmlEntities(ticket.event_name || ticket.product_name),
        startDate: ticket.event_date,
        endDate: ticket.event_end_date,
        location: decodeHtmlEntities(ticket.event_location || ""),
        notes: `Billet TicketByLamako · Commande #${order.number || order.id}`,
      });
      if (result === "created") {
        Alert.alert(
          "Ajouté au calendrier",
          "Un rappel a été programmé une heure avant l'événement.",
        );
      }
    } catch (error) {
      if (error instanceof CalendarPermissionDeniedError) {
        Alert.alert(
          "Autorisation calendrier",
          "Activez l'accès au calendrier dans les réglages de votre téléphone, puis réessayez.",
          [
            { text: "Plus tard", style: "cancel" },
            {
              text: "Ouvrir les réglages",
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return;
      }
      Alert.alert(
        "Calendrier indisponible",
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter cet événement au calendrier.",
      );
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleAddToWallet = async () => {
    if (!walletAvailable || walletBusy) return;
    setWalletBusy(true);
    try {
      const platform = Platform.OS === "ios" ? "apple" : "google";
      const response = await getMobileTicketWalletLink(
        order.id,
        ticket.instance_id,
        platform,
      );
      const result = await addTicketToNativeWallet(response.url);
      if (result === "added") {
        Alert.alert(
          "Billet ajouté",
          `Votre billet est maintenant disponible dans ${Platform.OS === "ios" ? "Apple Wallet" : "Google Wallet"}.`,
        );
      } else {
        Alert.alert(
          "Ajout interrompu",
          "Le billet n'a pas été ajouté. Il est peut-être déjà présent dans votre Wallet.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Wallet indisponible",
        error instanceof Error
          ? error.message
          : "Le billet n'a pas pu être ajouté. Réessayez dans quelques instants.",
      );
    } finally {
      setWalletBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.ticketCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Event identity */}
      <View style={styles.ticketHero}>
        {ticket.event_image ? (
          <CatalogImage
            uri={ticket.event_image}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={`Affiche de ${decodeHtmlEntities(ticket.event_name || ticket.product_name)}`}
            recyclingKey={`ticket-hero-${ticket.instance_id}`}
          />
        ) : null}
        <LinearGradient
          colors={
            ticket.event_image
              ? ["rgba(10,9,18,0.22)", "rgba(10,9,18,0.94)"]
              : isValid
                ? ["#2A1838", "#663D17"]
                : ["#4B5563", "#1F2937"]
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ticketHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketEyebrow}>BILLET OFFICIEL</Text>
            <Text style={styles.ticketHeaderTitle} numberOfLines={2}>
              {decodeHtmlEntities(ticket.event_name || ticket.product_name)}
            </Text>
            <Text style={styles.ticketHeaderSub} numberOfLines={2}>
              {decodeHtmlEntities(ticket.product_name)}
            </Text>
          </View>
          {total > 1 ? (
            <View style={styles.ticketBadge}>
              <Text style={styles.ticketBadgeText}>
                {index + 1}/{total}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* QR Code Section */}
      <View style={[styles.qrSection, { backgroundColor: colors.background }]}>
        {isValid ? (
          <>
            {isCheckedIn ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.checkedInBanner,
                  { borderColor: colors.success },
                ]}
              >
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={22}
                  color={colors.success}
                />
                <View style={styles.checkedInCopy}>
                  <Text
                    style={[
                      styles.checkedInTitle,
                      { color: colors.foreground },
                    ]}
                  >
                    Billet déjà scanné
                  </Text>
                  <Text
                    style={[styles.checkedInDetail, { color: colors.muted }]}
                  >
                    {ticket.checked_in_at
                      ? `Contrôlé le ${new Date(ticket.checked_in_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`
                      : "Ce billet a déjà été utilisé au contrôle d'entrée."}
                  </Text>
                </View>
              </View>
            ) : null}
            <View
              style={[styles.qrContainer, isCheckedIn && styles.checkedInQr]}
            >
              <QRCode
                value={qrValue}
                size={180}
                backgroundColor="#fff"
                color="#000"
              />
            </View>
            <Text style={[styles.qrHint, { color: colors.muted }]}>
              {isCheckedIn
                ? "QR conservé comme justificatif"
                : "Présentez ce QR code à l'entrée"}
            </Text>
            <Text style={[styles.ticketReference, { color: colors.muted }]}>
              Réf. {qrValue.slice(-8).toUpperCase()}
            </Text>
            <View style={styles.ticketActions}>
              {!isCheckedIn ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Afficher le QR code en plein écran"
                  onPress={onOpenEntry}
                  style={[
                    styles.entryButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <IconSymbol name="qrcode" size={19} color="#fff" />
                  <Text style={styles.entryButtonText}>Mode entrée</Text>
                </TouchableOpacity>
              ) : null}
              {ticket.event_date ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter l'événement au calendrier"
                  disabled={calendarBusy}
                  onPress={handleAddToCalendar}
                  style={[
                    styles.secondaryAction,
                    { borderColor: colors.border },
                  ]}
                >
                  {calendarBusy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <IconSymbol
                      name="calendar.badge.clock"
                      size={19}
                      color={colors.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: colors.foreground },
                    ]}
                  >
                    Calendrier
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {walletAvailable ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  Platform.OS === "ios"
                    ? "Ajouter à Apple Wallet"
                    : "Ajouter à Google Wallet"
                }
                onPress={handleAddToWallet}
                disabled={walletBusy}
                style={styles.walletButton}
              >
                {walletBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSymbol name="wallet.fill" size={19} color="#fff" />
                )}
                <Text style={styles.walletButtonText}>
                  {Platform.OS === "ios"
                    ? "Ajouter à Apple Wallet"
                    : "Ajouter à Google Wallet"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.invalidQr}>
            <IconSymbol
              name="xmark.circle.fill"
              size={48}
              color={colors.muted}
            />
            <Text style={[styles.invalidText, { color: colors.muted }]}>
              Billet non valide
            </Text>
            <Text style={[styles.invalidSub, { color: colors.muted }]}>
              Statut: {st.label}
            </Text>
          </View>
        )}
      </View>

      {/* Dashed separator */}
      <View style={[styles.dashedSep, { borderColor: colors.border }]} />

      {/* Ticket Details */}
      <View style={styles.detailsSection}>
        {/* Seat info */}
        {ticket.seat_label ? (
          <View style={[styles.seatRow, { backgroundColor: "#663d17" + "12" }]}>
            <IconSymbol name="mappin" size={16} color="#663d17" />
            <Text style={[styles.seatLabel, { color: "#663d17" }]}>
              Siège {ticket.seat_label}
            </Text>
          </View>
        ) : null}

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>
              Commande
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              #{order.number || order.id}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>
              Prix
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {formatAriary(String(ticket.price))}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>
              Date d'achat
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {formatDate(order.date_created)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.muted }]}>
              Statut
            </Text>
            <View
              style={[styles.statusPill, { backgroundColor: st.color + "15" }]}
            >
              <Text style={[styles.statusPillText, { color: st.color }]}>
                {st.label}
              </Text>
            </View>
          </View>
          {ticket.event_date ? (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Date événement
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {ticket.event_date}
              </Text>
            </View>
          ) : null}
          {ticket.event_location ? (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>
                Lieu
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {decodeHtmlEntities(ticket.event_location)}
              </Text>
            </View>
          ) : null}
        </View>

        {showMap && ticket.event_location ? (
          <EmbeddedGoogleMap
            location={decodeHtmlEntities(ticket.event_location)}
            height={190}
          />
        ) : null}

        {/* Attendee info */}
        <View style={[styles.attendeeRow, { borderTopColor: colors.border }]}>
          <IconSymbol name="person.fill" size={14} color={colors.muted} />
          <Text style={[styles.attendeeName, { color: colors.foreground }]}>
            {order.billing.first_name} {order.billing.last_name}
          </Text>
          <Text style={[styles.attendeeEmail, { color: colors.muted }]}>
            {order.billing.email}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id, ticketCode, ticketId } = useLocalSearchParams<{
    id: string;
    ticketCode?: string;
    ticketId?: string;
  }>();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<WCOrder | null>(null);
  const [tickets, setTickets] = useState<TicketInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showingOfflineCopy, setShowingOfflineCopy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entryIndex, setEntryIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const requestId = useRef(0);

  const applyTicketDetail = useCallback(
    (
      orderResponse: MobileOrderSummary,
      ticketsResponse: MobileOrderTicketsResponse,
    ) => {
      const orderData = mobileOrderToWCOrder(orderResponse);
      setOrder(orderData);
      setTickets(
        orderAllowsTicketDisplay(orderResponse)
          ? ticketsResponse.tickets.map(mobileTicketToTicketInstance)
          : [],
      );
    },
    [],
  );

  const loadData = useCallback(async () => {
    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setLoading(false);
      setErrorMessage("Cette référence de billet est invalide.");
      return;
    }

    const activeRequest = ++requestId.current;
    setLoading(true);
    setErrorMessage(null);
    setShowingOfflineCopy(false);

    let hasCachedCopy = false;
    if (user?.id) {
      const cached = await getCachedTicketDetail(user.id, orderId);
      if (requestId.current !== activeRequest) return;
      if (cached) {
        applyTicketDetail(cached.order, cached.tickets);
        hasCachedCopy = true;
        setLoading(false);
      }
    }

    try {
      const orderResponse = await getMobileOrder(orderId);
      if (requestId.current !== activeRequest) return;

      const ticketsResponse: MobileOrderTicketsResponse =
        orderAllowsTicketDisplay(orderResponse)
          ? await getMobileOrderTickets(orderId)
          : {
              orderId,
              orderStatus: orderResponse.status,
              ticketsReady: false,
              tickets: [],
            };
      if (requestId.current !== activeRequest) return;

      applyTicketDetail(orderResponse, ticketsResponse);
      setShowingOfflineCopy(false);
      setLoading(false);
      if (user?.id) {
        if (
          orderAllowsTicketDisplay(orderResponse) &&
          ticketsResponse.ticketsReady &&
          ticketsResponse.tickets.length > 0
        ) {
          await setCachedTicketDetail(
            user.id,
            orderResponse,
            ticketsResponse,
          ).catch(() => undefined);
        } else {
          await removeCachedTicketDetail(user.id, orderId).catch(
            () => undefined,
          );
        }
      }
    } catch (error) {
      if (requestId.current !== activeRequest) return;
      if (error instanceof MobileApiError && error.status === 401) {
        if (user?.id) await removeCachedTicketDetail(user.id, orderId);
        setOrder(null);
        setTickets([]);
        setErrorMessage(
          "Votre session a expiré. Reconnectez-vous pour afficher ce billet.",
        );
      } else if (error instanceof MobileApiError && error.status === 403) {
        if (user?.id) await removeCachedTicketDetail(user.id, orderId);
        setOrder(null);
        setTickets([]);
        setErrorMessage("Ce billet n'est pas associé à votre compte.");
      } else if (hasCachedCopy) {
        setShowingOfflineCopy(true);
      } else {
        setErrorMessage(
          "Impossible de charger ce billet. Vérifiez votre connexion puis réessayez.",
        );
      }
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, [applyTicketDetail, id, user?.id]);

  useEffect(() => {
    void loadData();
    return () => {
      requestId.current += 1;
    };
  }, [loadData]);

  // If a specific ticket code was requested, scroll to it
  useEffect(() => {
    if ((ticketCode || ticketId) && tickets.length > 0) {
      const idx = tickets.findIndex((ticket) =>
        ticketCode
          ? ticket.ticket_code === ticketCode
          : String(ticket.instance_id) === String(ticketId),
      );
      if (idx >= 0) {
        setActiveIndex(idx);
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            x: idx * (SCREEN_W - 32),
            animated: true,
          });
        }, 300);
      }
    }
  }, [ticketCode, ticketId, tickets]);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.backBtn} />
          <View
            style={[styles.headerSkeleton, { backgroundColor: colors.border }]}
          />
          <View style={{ width: 40 }} />
        </View>
        <View
          accessibilityLabel="Chargement du billet"
          style={styles.detailSkeleton}
        >
          <View
            style={[styles.heroSkeleton, { backgroundColor: colors.border }]}
          />
          <View style={[styles.qrSkeleton, { borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <View
            style={[styles.lineSkeleton, { backgroundColor: colors.border }]}
          />
          <View
            style={[
              styles.lineSkeletonShort,
              { backgroundColor: colors.border },
            ]}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage || !order) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <View
          style={[styles.errorIcon, { backgroundColor: colors.warning + "14" }]}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={34}
            color={colors.warning}
          />
        </View>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Billet indisponible
        </Text>
        <Text style={[styles.errorCopy, { color: colors.muted }]}>
          {errorMessage || "Commande introuvable"}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={loadData}
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
          <Text style={{ color: colors.primary }}>Retour à mes billets</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (tickets.length === 0) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Billets
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <IconSymbol name="ticket.fill" size={48} color={colors.muted} />
          <Text
            style={{
              color: colors.muted,
              fontSize: 16,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Aucun billet trouvé pour cette commande
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {entryIndex !== null && tickets[entryIndex] ? (
        <EntryMode
          ticket={tickets[entryIndex]}
          order={order}
          index={entryIndex}
          total={tickets.length}
          onClose={() => setEntryIndex(null)}
        />
      ) : null}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retour à mes billets"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {tickets.length === 1
            ? "Mon Billet"
            : `Mes Billets (${tickets.length})`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {showingOfflineCopy ? (
        <View
          accessibilityRole="alert"
          style={[
            styles.offlineBanner,
            { backgroundColor: colors.warning + "14" },
          ]}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={15}
            color={colors.warning}
          />
          <Text style={[styles.offlineText, { color: colors.foreground }]}>
            Copie hors ligne. Le billet sera actualisé au retour du réseau.
          </Text>
        </View>
      ) : null}

      {/* Explicit ticket selector */}
      {tickets.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ticketSelector}
        >
          {tickets.map((ticket, i) => {
            const selected = i === activeIndex;
            return (
              <TouchableOpacity
                key={ticket.instance_id || i}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Afficher le billet ${i + 1}${ticket.seat_label ? `, place ${ticket.seat_label}` : ""}`}
                onPress={() => {
                  setActiveIndex(i);
                  scrollRef.current?.scrollTo({
                    x: i * (SCREEN_W - 32),
                    animated: true,
                  });
                }}
                style={[
                  styles.ticketSelectorItem,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ticketSelectorText,
                    { color: selected ? "#fff" : colors.foreground },
                  ]}
                >
                  Billet {i + 1}
                  {ticket.seat_label ? ` · ${ticket.seat_label}` : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Tickets horizontal scroll */}
      {tickets.length === 1 ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <TicketCard
            ticket={tickets[0]}
            order={order}
            index={0}
            total={1}
            colors={colors}
            onOpenEntry={() => setEntryIndex(0)}
            showMap
          />
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / (SCREEN_W - 32),
            );
            setActiveIndex(Math.max(0, Math.min(idx, tickets.length - 1)));
          }}
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          {tickets.map((ticket, i) => (
            <ScrollView
              key={i}
              style={{ width: SCREEN_W - 32, marginHorizontal: 16 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <TicketCard
                ticket={ticket}
                order={order}
                index={i}
                total={tickets.length}
                colors={colors}
                onOpenEntry={() => setEntryIndex(i)}
                showMap={i === activeIndex}
              />
            </ScrollView>
          ))}
        </ScrollView>
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
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSkeleton: { width: 112, height: 16, borderRadius: 4, opacity: 0.55 },
  offlineBanner: {
    minHeight: 38,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineText: { flex: 1, fontSize: 12, lineHeight: 17 },
  detailSkeleton: {
    margin: 16,
    padding: 18,
    borderRadius: 8,
    alignItems: "center",
  },
  heroSkeleton: { width: "100%", height: 72, borderRadius: 8, opacity: 0.5 },
  qrSkeleton: {
    width: 204,
    height: 204,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  lineSkeleton: {
    width: "68%",
    height: 13,
    borderRadius: 4,
    marginTop: 26,
    opacity: 0.5,
  },
  lineSkeletonShort: {
    width: "42%",
    height: 10,
    borderRadius: 4,
    marginTop: 12,
    opacity: 0.4,
  },
  errorIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: { fontSize: 18, fontWeight: "700", marginTop: 16 },
  errorCopy: {
    maxWidth: 320,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 24,
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 18,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  backLink: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  ticketSelector: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  ticketSelectorItem: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketSelectorText: { fontSize: 13, fontWeight: "700" },
  ticketCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#120B05",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  ticketHero: {
    minHeight: 178,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  ticketHeader: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ticketEyebrow: {
    color: "#F9C96B",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 6,
  },
  ticketHeaderTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  ticketHeaderSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 4,
  },
  ticketBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  ticketBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  qrSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  qrContainer: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  checkedInQr: { opacity: 0.3 },
  checkedInBanner: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkedInCopy: { flex: 1 },
  checkedInTitle: { fontSize: 14, fontWeight: "800" },
  checkedInDetail: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  qrHint: { fontSize: 12, marginTop: 10 },
  ticketReference: { fontSize: 10, marginTop: 4, fontWeight: "600" },
  ticketActions: {
    width: "100%",
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  entryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  entryButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryActionText: { fontSize: 13, fontWeight: "700" },
  walletButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#050505",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  walletButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  invalidQr: { alignItems: "center", paddingVertical: 20 },
  invalidText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  invalidSub: { fontSize: 13, marginTop: 4 },
  dashedSep: { borderTopWidth: 1, borderStyle: "dashed", marginHorizontal: 16 },
  detailsSection: { padding: 16 },
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  seatLabel: { fontSize: 15, fontWeight: "700" },
  infoGrid: { gap: 10 },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { fontSize: 13 },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: "600" },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    flexWrap: "wrap",
  },
  attendeeName: { fontSize: 14, fontWeight: "600" },
  attendeeEmail: { fontSize: 12 },
  entryScreen: { flex: 1, backgroundColor: "#090A0D" },
  entryHeader: {
    minHeight: 72,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  entryEyebrow: { color: "#59D98E", fontSize: 11, fontWeight: "900" },
  entryCounter: { color: "#fff", fontSize: 13, marginTop: 3 },
  entryClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#22242A",
    alignItems: "center",
    justifyContent: "center",
  },
  entryContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  entryEvent: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  entryType: {
    color: "#B8BBC5",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },
  entrySeat: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 16,
  },
  entrySeatLabel: { color: "#8F94A3", fontSize: 11, fontWeight: "800" },
  entrySeatValue: { color: "#F3B93F", fontSize: 25, fontWeight: "900" },
  entryQr: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 20,
  },
  entryReady: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  entryReadyText: { color: "#D6D8DE", fontSize: 12, fontWeight: "600" },
  entryOrder: { color: "#7F8492", fontSize: 11, marginTop: 10 },
});

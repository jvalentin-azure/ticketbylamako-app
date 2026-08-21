import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  FlatList,
  Platform,
  Linking,
  Share,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { EventDetailSkeleton } from "@/components/event-detail-skeleton";
import { EventPosterCard } from "@/components/event-poster-card";
import { CatalogImage } from "@/components/catalog-image";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getTCEvent,
  getEventsData,
  type TCEvent,
  type TicketType,
} from "@/lib/api/catalog";
import { useAuth } from "@/lib/auth-provider";
import { useFavorites } from "@/lib/favorites-provider";
import {
  formatAriary,
  formatDate,
  stripHtml,
  decodeHtmlEntities,
} from "@/lib/format";
import { PointsBadge } from "@/components/points-badge";
import { CartToast } from "@/components/cart-toast";
import { SeatPurchaseFlow } from "@/components/seating/SeatPurchaseFlow";

const { width: SCREEN_W } = Dimensions.get("window");

type EventDetailsTab = "description" | "location" | "conditions";

function isEventSalesClosed(event?: TCEvent | null) {
  return (
    event?.salesClosed === true ||
    event?.isPastEvent === true ||
    event?.ticketingStatus === "ended"
  );
}

function isTicketAvailable(ticket?: TicketType | null) {
  return (
    !!ticket &&
    ticket.purchasable !== false &&
    ticket.salesClosed !== true &&
    ticket.ticketingStatus !== "ended"
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const [event, setEvent] = useState<TCEvent | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [qty, setQty] = useState(1);
  const [showSeatingChart, setShowSeatingChart] = useState(false);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [upcomingEvents, setUpcomingEvents] = useState<TCEvent[]>([]);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    mins: number;
    secs: number;
  } | null>(null);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [showCartToast, setShowCartToast] = useState(false);
  const [cartToastName, setCartToastName] = useState("");
  const [activeDetailsTab, setActiveDetailsTab] =
    useState<EventDetailsTab>("description");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setEvent(null);
    setTickets([]);
    setSelectedTicket(null);
    setQty(1);
    setGalleryIndex(0);
    setActiveDetailsTab("description");
    const eventId = Number(id);
    let cancelled = false;
    let detailApplied = false;

    const applyEvent = (nextEvent: TCEvent, source: "catalogue" | "detail") => {
      if (cancelled) return;
      if (source === "catalogue" && detailApplied) return;
      if (source === "detail") detailApplied = true;
      const nextTickets = nextEvent.tickets || [];
      setEvent(nextEvent);
      setLoadError(null);
      setTickets(nextTickets);
      const firstAvailable = nextTickets.find(isTicketAvailable);
      if (nextTickets.length === 1 && firstAvailable) {
        setSelectedTicket(firstAvailable);
      }
      setLoading(false);
    };

    // Start both requests immediately. The compact catalogue can paint from its
    // memory cache, while the detail request no longer waits several seconds for it.
    const catalogueRequest = getEventsData().then(({ events: allEvents }) => {
      if (cancelled) return;
      const cachedEvent = allEvents.find((item) => item.id === eventId);
      if (cachedEvent) applyEvent(cachedEvent, "catalogue");

      const now = Date.now();
      setUpcomingEvents(
        allEvents
          .filter((item) => {
            if (item.id === eventId) return false;
            const date = item.mobileFields?.event_date_time;
            if (!date) return true;
            return new Date(date.replace(" ", "T")).getTime() > now;
          })
          .slice(0, 8),
      );
    });

    const detailRequest = getTCEvent(eventId).then((nextEvent) => {
      applyEvent(nextEvent, "detail");
    });

    Promise.allSettled([catalogueRequest, detailRequest]).then((results) => {
      if (cancelled) return;
      if (results.every((result) => result.status === "rejected")) {
        setLoadError(
          "Impossible de charger cet événement. Vérifiez votre connexion puis réessayez.",
        );
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, retryKey]);

  // Countdown timer (updates every second)
  useEffect(() => {
    if (!event) return;
    const dateStr = event.mobileFields?.event_date_time;
    if (!dateStr) return;
    const eventTime = new Date(dateStr.replace(" ", "T")).getTime();
    if (eventTime <= Date.now()) {
      setCountdown(null);
      return;
    }
    const update = () => {
      const diff = eventTime - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        return;
      }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [event]);

  useEffect(() => {
    if (!event || !selectedTicket) return;
    if (isEventSalesClosed(event) || !isTicketAvailable(selectedTicket)) {
      setSelectedTicket(null);
    }
  }, [event, selectedTicket]);

  if (loading) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
        <EventDetailSkeleton />
      </ScreenContainer>
    );
  }

  if (!event) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={34}
          color={colors.primary}
        />
        <Text style={[styles.loadErrorTitle, { color: colors.foreground }]}>
          Événement indisponible
        </Text>
        <Text style={[styles.loadErrorMessage, { color: colors.muted }]}>
          {loadError || "Cet événement est introuvable."}
        </Text>
        {loadError ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Réessayer de charger l'événement"
            activeOpacity={0.8}
            onPress={() => setRetryKey((value) => value + 1)}
            style={[
              styles.loadRetryButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color="#fff" />
            <Text style={styles.loadRetryText}>Réessayer</Text>
          </TouchableOpacity>
        ) : null}
      </ScreenContainer>
    );
  }

  const name = decodeHtmlEntities(event.title.rendered);
  const mobileDesc = event.mobileFields?.description
    ? decodeHtmlEntities(event.mobileFields.description)
    : "";
  const siteDesc = stripHtml(event.content?.rendered || "");
  const desc = mobileDesc || siteDesc;
  const gallery = event.mobileFields?.gallery;
  const practicalInfo = event.mobileFields?.practical_info;
  const cats = event.categoryNames?.join(", ") || "";
  const hasSeating = tickets.some((t) => t.usesSeating);
  const eventClosed = isEventSalesClosed(event);
  const closedMessage = event.ticketingMessage || "Cet événement est terminé.";
  const eventLocation = event.mobileFields?.event_location
    ? decodeHtmlEntities(event.mobileFields.event_location).trim()
    : "";
  const eventTerms = event.mobileFields?.event_terms
    ? decodeHtmlEntities(event.mobileFields.event_terms).trim()
    : "";
  const detailTabs: {
    key: EventDetailsTab;
    label: string;
    icon: "doc.text.fill" | "mappin" | "checkmark.shield.fill";
  }[] = [
    ...(desc
      ? [
          {
            key: "description" as const,
            label: "Présentation",
            icon: "doc.text.fill" as const,
          },
        ]
      : []),
    ...(eventLocation
      ? [{ key: "location" as const, label: "Lieu", icon: "mappin" as const }]
      : []),
    ...(eventTerms
      ? [
          {
            key: "conditions" as const,
            label: "Conditions",
            icon: "checkmark.shield.fill" as const,
          },
        ]
      : []),
  ];
  const visibleDetailsTab = detailTabs.some(
    (tab) => tab.key === activeDetailsTab,
  )
    ? activeDetailsTab
    : detailTabs[0]?.key;

  const openDirections = () => {
    if (!eventLocation) return;
    const query = encodeURIComponent(eventLocation);
    void Linking.openURL(
      Platform.OS === "ios"
        ? `https://maps.apple.com/?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`,
    );
  };

  // Build image list: featured image + gallery
  const allImages: string[] = [];
  if (event.featuredImage) allImages.push(event.featuredImage);
  if (gallery && gallery.length > 0) {
    gallery.forEach((img) => {
      if (img && !allImages.includes(img)) allImages.push(img);
    });
  }
  const bottomSafePadding = Math.max(insets.bottom, 16) + 12;

  const handleAddToCart = () => {
    if (!selectedTicket) return;
    if (eventClosed || !isTicketAvailable(selectedTicket)) {
      Alert.alert("Billetterie fermée", closedMessage);
      return;
    }
    const itemName = `${name} - ${selectedTicket.name}`;
    setCartToastName(itemName);
    setShowCartToast(true);
    // Keep the confirmation visible without making add-to-cart feel sluggish.
    setTimeout(() => {
      router.push("/(tabs)/cart" as any);
    }, 650);
    addItem({
      productId: selectedTicket.id,
      name: itemName,
      price: parseFloat(selectedTicket.price) || 0,
      image: event.featuredImage || "",
      quantity: qty,
      isEvent: true,
      eventId: event.id,
      hasCheckoutFields: selectedTicket.hasCheckoutFields,
      requiresCheckoutFields: selectedTicket.requiresCheckoutFields,
      lamakoRewardsEnabled:
        event.lamakoRewardsEnabled !== false &&
        selectedTicket.lamakoRewardsEnabled !== false,
      purchasable: selectedTicket.purchasable,
      salesClosed: selectedTicket.salesClosed,
      ticketingStatus: selectedTicket.ticketingStatus,
      ticketingMessage: selectedTicket.ticketingMessage,
    });
  };

  const handleOpenSeatingChart = async () => {
    if (!hasSeating || !event) return;
    if (eventClosed) {
      Alert.alert("Billetterie fermée", closedMessage);
      return;
    }

    // REQUIRE AUTH: User must be logged in before opening seating chart
    // This prevents the admin login exposure issue and ensures WC session is linked to user
    if (!isAuthenticated) {
      Alert.alert(
        "Connexion requise",
        "Vous devez être connecté pour réserver des sièges.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Se connecter",
            onPress: () => router.push("/(auth)/login" as any),
          },
        ],
      );
      return;
    }

    setSeatingLoading(true);
    try {
      setShowSeatingChart(true);
    } catch (e) {
      console.warn("Seating chart open error:", e);
    } finally {
      setSeatingLoading(false);
    }
  };

  if (showSeatingChart && event) {
    return (
      <SeatPurchaseFlow
        eventId={event.id}
        eventTitle={name}
        onClose={() => setShowSeatingChart(false)}
      />
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <CartToast
        visible={showCartToast}
        itemName={cartToastName}
        onHide={() => setShowCartToast(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.eventScroll}
        contentContainerStyle={[
          styles.eventScrollContent,
          { paddingBottom: bottomSafePadding + 24 },
        ]}
      >
        {/* Hero Image / Gallery */}
        <View style={{ position: "relative" }}>
          {allImages.length > 1 ? (
            <View>
              <FlatList
                data={allImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / SCREEN_W,
                  );
                  setGalleryIndex(idx);
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) => (
                  <CatalogImage
                    uri={item}
                    style={{ width: SCREEN_W, height: 280 }}
                    accessibilityLabel={`Photo ${index + 1} de ${name}`}
                    recyclingKey={`event-gallery-${event.id}-${item}`}
                  />
                )}
              />
              {/* Gallery dots */}
              <View style={styles.galleryDots}>
                {allImages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i === galleryIndex ? "#fff" : "rgba(255,255,255,0.5)",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <CatalogImage
              uri={event.featuredImage}
              style={{ width: SCREEN_W, height: 280 }}
              accessibilityLabel={`Affiche de ${name}`}
              recyclingKey={`event-featured-${event.id}`}
            />
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Share & Favorite buttons */}
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await Share.share({
                    title: name,
                    message: `${name} - Découvrez cet événement sur TicketByLamako !\n${event.link || `https://www.ticketbylamako.com/tc-events/${event.slug}/`}`,
                    url:
                      event.link ||
                      `https://www.ticketbylamako.com/tc-events/${event.slug}/`,
                  });
                } catch {}
              }}
              style={styles.topActionBtn}
            >
              <IconSymbol name="square.and.arrow.up" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                toggleFavorite({
                  id: event.id,
                  type: "event",
                  name,
                  image: event.featuredImage,
                })
              }
              style={styles.topActionBtn}
            >
              <IconSymbol
                name={isFavorite(event.id, "event") ? "heart.fill" : "heart"}
                size={18}
                color={isFavorite(event.id, "event") ? "#EF4444" : "#fff"}
              />
            </TouchableOpacity>
          </View>
          {hasSeating && (
            <View style={styles.seatingOverlayBadge}>
              <IconSymbol name="mappin" size={12} color="#fff" />
              <Text style={styles.seatingOverlayText}>
                Plan de salle disponible
              </Text>
            </View>
          )}
        </View>

        <View style={{ padding: 20 }}>
          {/* COUNTDOWN - compact at top */}
          {countdown && (
            <View style={styles.countdownCompact}>
              <Text style={styles.countdownCompactText}>
                {countdown.days}j {String(countdown.hours).padStart(2, "0")}h{" "}
                {String(countdown.mins).padStart(2, "0")}m{" "}
                {String(countdown.secs).padStart(2, "0")}s
              </Text>
              <Text style={styles.countdownCompactLabel}>
                avant l'événement
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {name}
          </Text>

          {/* Categories */}
          {cats ? (
            <View style={styles.catsRow}>
              <IconSymbol name="tag.fill" size={14} color={colors.primary} />
              <Text style={[styles.catsText, { color: colors.primary }]}>
                {cats}
              </Text>
            </View>
          ) : null}

          {/* Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <View
                style={[
                  styles.infoIcon,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <IconSymbol name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>
                  Date
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {formatDate(event.date)}
                </Text>
              </View>
            </View>
          </View>

          {/* Practical Info Table */}
          {practicalInfo && practicalInfo.length > 0 && (
            <View
              style={[
                styles.practicalInfoBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, marginBottom: 12 },
                ]}
              >
                Infos pratiques
              </Text>
              {practicalInfo.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.practicalInfoRow,
                    idx < practicalInfo.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.practicalInfoLabel, { color: colors.muted }]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.practicalInfoValue,
                      { color: colors.foreground },
                    ]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Price Range */}
          {tickets.length > 0 && (
            <View
              style={[
                styles.priceBox,
                {
                  backgroundColor: colors.primary + "10",
                  borderColor: colors.primary + "30",
                },
              ]}
            >
              <Text style={[styles.priceLabel, { color: colors.primary }]}>
                {tickets.length === 1 ? "Prix" : "À partir de"}
              </Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                {tickets.length === 1
                  ? formatAriary(tickets[0].price)
                  : formatAriary(
                      Math.min(...tickets.map((t) => parseFloat(t.price) || 0)),
                    )}
              </Text>
              {event.lamakoRewardsEnabled !== false && (
                <PointsBadge
                  price={
                    tickets.length === 1
                      ? tickets[0].price
                      : Math.min(
                          ...tickets.map((t) => parseFloat(t.price) || 0),
                        )
                  }
                  compact={false}
                />
              )}
            </View>
          )}

          {eventClosed && (
            <View
              style={[
                styles.closedNotice,
                { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
              ]}
            >
              <IconSymbol name="xmark.circle.fill" size={18} color="#b91c1c" />
              <Text style={styles.closedNoticeText}>{closedMessage}</Text>
            </View>
          )}

          {/* Ticket Types */}
          {tickets.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {hasSeating
                  ? "Types de billets disponibles"
                  : "Types de billets"}
              </Text>
              {hasSeating && (
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  La sélection se fait directement sur le plan de salle
                  ci-dessous
                </Text>
              )}
              {tickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                const ticketClosed = eventClosed || !isTicketAvailable(ticket);
                // For seated events: info-only display (no selection)
                if (hasSeating) {
                  return (
                    <View
                      key={ticket.id}
                      style={[
                        styles.ticketOption,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: ticketClosed ? 0.55 : 1,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: ticket.usesSeating
                            ? "#c79f6c"
                            : colors.primary,
                          marginRight: 10,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.ticketName,
                            { color: colors.foreground },
                          ]}
                        >
                          {decodeHtmlEntities(ticket.name)}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 2,
                          }}
                        >
                          <IconSymbol name="mappin" size={10} color="#c79f6c" />
                          <Text
                            style={{
                              color: "#c79f6c",
                              fontSize: 11,
                              marginLeft: 4,
                            }}
                          >
                            {ticketClosed
                              ? "Billetterie fermée"
                              : "Sélection sur le plan"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.ticketPrice, { color: colors.primary }]}
                      >
                        {formatAriary(ticket.price)}
                      </Text>
                    </View>
                  );
                }
                // For non-seated events: normal selection with radio
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => {
                      if (ticketClosed) return;
                      setSelectedTicket(ticket);
                      setQty(1);
                    }}
                    disabled={ticketClosed}
                    style={[
                      styles.ticketOption,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "10"
                          : colors.surface,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        opacity: ticketClosed ? 0.55 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: isSelected
                            ? colors.primary
                            : colors.muted,
                        },
                      ]}
                    >
                      {isSelected && (
                        <View
                          style={[
                            styles.radioInner,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.ticketName,
                          { color: colors.foreground },
                        ]}
                      >
                        {decodeHtmlEntities(ticket.name)}
                      </Text>
                      {ticketClosed && (
                        <Text style={styles.ticketClosedText}>
                          {ticket.ticketingMessage || closedMessage}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[styles.ticketPrice, { color: colors.primary }]}
                    >
                      {formatAriary(ticket.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Seating Chart Button */}
          {hasSeating && (
            <TouchableOpacity
              onPress={handleOpenSeatingChart}
              disabled={seatingLoading || eventClosed}
              style={[
                styles.seatingChartBtn,
                {
                  backgroundColor: "#663d17",
                  opacity: seatingLoading || eventClosed ? 0.7 : 1,
                },
              ]}
            >
              {seatingLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <IconSymbol name="mappin" size={18} color="#fff" />
              )}
              <Text style={styles.seatingChartBtnText}>
                {eventClosed
                  ? "Billetterie fermée"
                  : seatingLoading
                    ? "Chargement..."
                    : "Voir le plan de salle & choisir mon siège"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Quantity (for non-seating tickets only) */}
          {selectedTicket && !hasSeating && (
            <View
              style={[
                styles.qtyRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.qtyLabel, { color: colors.foreground }]}>
                Quantité
              </Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  style={[styles.qtyBtn, { backgroundColor: colors.border }]}
                >
                  <Text
                    style={[styles.qtyBtnText, { color: colors.foreground }]}
                  >
                    -
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.qtyValue, { color: colors.foreground }]}>
                  {qty}
                </Text>
                <TouchableOpacity
                  onPress={() => setQty((q) => q + 1)}
                  style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {detailTabs.length > 0 ? (
            <View style={styles.detailsSection}>
              <View
                accessibilityRole="tablist"
                style={[styles.detailsTabs, { borderColor: colors.border }]}
              >
                {detailTabs.map((tab) => {
                  const selected = visibleDetailsTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      accessibilityLabel={tab.label}
                      onPress={() => setActiveDetailsTab(tab.key)}
                      style={styles.detailsTab}
                    >
                      <IconSymbol
                        name={tab.icon}
                        size={15}
                        color={selected ? colors.primary : colors.muted}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.detailsTabText,
                          { color: selected ? colors.primary : colors.muted },
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {selected ? (
                        <View
                          style={[
                            styles.detailsTabIndicator,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.detailsPanel}>
                {visibleDetailsTab === "description" && desc ? (
                  <>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.foreground },
                      ]}
                    >
                      À propos de l'événement
                    </Text>
                    <Text style={[styles.descText, { color: colors.muted }]}>
                      {desc}
                    </Text>
                  </>
                ) : null}

                {visibleDetailsTab === "conditions" && eventTerms ? (
                  <>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.foreground },
                      ]}
                    >
                      Conditions d'accès
                    </Text>
                    <Text
                      style={[styles.descText, { color: colors.muted }]}
                      numberOfLines={showFullTerms ? undefined : 4}
                    >
                      {eventTerms}
                    </Text>
                    {eventTerms.length > 150 ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setShowFullTerms(!showFullTerms)}
                      >
                        <Text
                          style={[
                            styles.showMoreText,
                            { color: colors.primary },
                          ]}
                        >
                          {showFullTerms ? "Voir moins" : "Voir plus"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}

                {visibleDetailsTab === "location" && eventLocation ? (
                  <>
                    <View style={styles.locationRow}>
                      <IconSymbol
                        name="mappin"
                        size={18}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.locationText,
                          { color: colors.foreground },
                        ]}
                      >
                        {eventLocation}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel={`Afficher l'itinéraire vers ${eventLocation}`}
                      onPress={openDirections}
                      style={[
                        styles.mapAction,
                        {
                          backgroundColor: colors.primary + "10",
                          borderColor: colors.primary + "35",
                        },
                      ]}
                    >
                      <IconSymbol
                        name="map.fill"
                        size={22}
                        color={colors.primary}
                      />
                      <View style={styles.mapActionCopy}>
                        <Text
                          style={[
                            styles.mapActionTitle,
                            { color: colors.foreground },
                          ]}
                        >
                          Ouvrir l'itinéraire
                        </Text>
                        <Text
                          style={[
                            styles.mapActionHint,
                            { color: colors.muted },
                          ]}
                        >
                          Afficher le trajet dans votre application de cartes.
                        </Text>
                      </View>
                      <IconSymbol
                        name="chevron.right"
                        size={18}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* UPCOMING EVENTS */}
          {upcomingEvents.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <View style={styles.upcomingHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.foreground, marginBottom: 0 },
                  ]}
                >
                  Événements à venir
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/events" as any)}
                >
                  <Text
                    style={[styles.getDirections, { color: colors.primary }]}
                  >
                    Voir tout
                  </Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={upcomingEvents}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingRight: 16,
                  gap: 12,
                  marginTop: 12,
                }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <EventPosterCard
                    event={item}
                    onPress={() => router.push(`/event/${item.id}` as any)}
                    width={218}
                    favorite={isFavorite(item.id, "event")}
                    onToggleFavorite={() =>
                      toggleFavorite({
                        id: item.id,
                        type: "event",
                        name: decodeHtmlEntities(item.title.rendered),
                        image: item.featuredImage,
                      })
                    }
                  />
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          styles.bottomCta,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: bottomSafePadding,
          },
        ]}
      >
        {hasSeating ? (
          <TouchableOpacity
            onPress={handleOpenSeatingChart}
            disabled={seatingLoading || eventClosed}
            style={[
              styles.ctaButton,
              {
                backgroundColor: eventClosed ? colors.muted : "#663d17",
                opacity: seatingLoading ? 0.7 : 1,
              },
            ]}
          >
            {seatingLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol name="mappin" size={20} color="#fff" />
            )}
            <Text style={styles.ctaButtonText}>
              {eventClosed
                ? "Billetterie fermée"
                : seatingLoading
                  ? "Chargement du plan..."
                  : "Choisir mon siège"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={
              !selectedTicket ||
              eventClosed ||
              !isTicketAvailable(selectedTicket)
            }
            style={[
              styles.ctaButton,
              {
                backgroundColor:
                  selectedTicket &&
                  !eventClosed &&
                  isTicketAvailable(selectedTicket)
                    ? colors.primary
                    : colors.muted,
                opacity:
                  selectedTicket &&
                  !eventClosed &&
                  isTicketAvailable(selectedTicket)
                    ? 1
                    : 0.5,
              },
            ]}
          >
            <IconSymbol name="cart.fill" size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>
              {eventClosed
                ? "Billetterie fermée"
                : selectedTicket && isTicketAvailable(selectedTicket)
                  ? `Ajouter au panier - ${formatAriary(Number(selectedTicket.price) * qty)}`
                  : "S\u00e9lectionnez un billet"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadErrorTitle: {
    marginTop: 14,
    fontSize: 20,
    fontFamily: "Raleway_700Bold",
    textAlign: "center",
  },
  loadErrorMessage: {
    marginTop: 8,
    maxWidth: 340,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Raleway_500Medium",
    textAlign: "center",
  },
  loadRetryButton: {
    minHeight: 48,
    marginTop: 20,
    paddingHorizontal: 22,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadRetryText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Raleway_700Bold",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  seatingOverlayBadge: {
    position: "absolute",
    bottom: 12,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  seatingOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700" },
  catsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  catsText: { fontSize: 13, fontWeight: "600" },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 },
  infoItem: { flexDirection: "row", alignItems: "center" },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 13, fontWeight: "600" },
  practicalInfoBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  practicalInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  practicalInfoLabel: { fontSize: 13, flex: 1 },
  practicalInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  priceBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  priceLabel: { fontSize: 13, fontWeight: "600" },
  priceValue: { fontSize: 28, fontWeight: "800", marginTop: 2 },
  closedNotice: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  closedNoticeText: {
    flex: 1,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  ticketOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  ticketName: { fontSize: 14, fontWeight: "600" },
  ticketClosedText: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  ticketPrice: { fontSize: 15, fontWeight: "700" },
  seatingChartBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  seatingChartBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  qtyLabel: { fontSize: 15, fontWeight: "600" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qtyValue: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  descText: { fontSize: 14, lineHeight: 22 },
  eventScroll: { flex: 1 },
  eventScrollContent: { paddingBottom: 24 },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  ctaButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  galleryDots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  seatingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  seatingBackBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  seatingBackText: { fontSize: 15 },
  seatingTitle: { fontSize: 16, fontWeight: "700" },
  webFallbackBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  webFallbackBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  topRightActions: {
    position: "absolute",
    top: 12,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  topActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    alignItems: "center",
  },
  confirmBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  confirmHint: { marginTop: 6, fontSize: 12, textAlign: "center" },
  // Countdown (compact at top)
  countdownCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#663d17",
  },
  countdownCompactText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  countdownCompactLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  detailsSection: { marginTop: 24 },
  detailsTabs: {
    minHeight: 50,
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  detailsTab: {
    minWidth: 0,
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    position: "relative",
  },
  detailsTabText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  detailsTabIndicator: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: -1,
    height: 3,
    borderRadius: 2,
  },
  detailsPanel: { minHeight: 120, paddingTop: 18 },
  showMoreText: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  getDirections: { fontSize: 13, fontWeight: "600" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  locationText: { fontSize: 14, flex: 1 },
  mapAction: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  mapActionCopy: { flex: 1 },
  mapActionTitle: { fontSize: 14, fontFamily: "Raleway_700Bold" },
  mapActionHint: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Raleway_500Medium",
  },
  // Upcoming events
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
});

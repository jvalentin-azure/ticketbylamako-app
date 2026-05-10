import { useEffect, useState, useRef, useCallback } from "react";
import {
  ScrollView, Text, View, FlatList, Dimensions,
  TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Image as RNImage } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getHomeData, type TCEvent, type WCProduct } from "@/lib/api/catalog";
import { formatAriary, formatDateShort, decodeHtmlEntities } from "@/lib/format";
import { useRewards } from "@/lib/rewards-provider";
import { useFavorites } from "@/lib/favorites-provider";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyNewEvent } from "@/lib/notifications";
import { setPendingCategory } from "@/lib/filter-state";
import { PARENT_CATEGORY_COLORS } from "@/constants/category-colors";
import { PointsBadge } from "@/components/points-badge";
import { OrganizerEventCta } from "@/components/organizer-event-cta";
// Cache removed for stock-critical data (events/products) to ensure real-time availability

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 220;

/** Check if an event is upcoming (event_date_time > now) */
function isUpcoming(event: TCEvent): boolean {
  const dateStr = event.mobileFields?.event_date_time;
  if (!dateStr) {
    // Fallback: use post date, assume events published in last 60 days are upcoming
    const postDate = new Date(event.date);
    const now = new Date();
    const diffDays = (postDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > -7; // within past week or future
  }
  const eventDate = new Date(dateStr.replace(" ", "T"));
  return eventDate.getTime() > Date.now();
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { state: rewardsState, currentTier } = useRewards();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<FlatList>(null);

  const load = useCallback(async (forceRefresh = false) => {
    try {
      // Single optimized endpoint - fresh data, no cache (stock-critical)
      const { events: ev, products: pr } = await getHomeData();
      setEvents(ev);
      setProducts(pr);

      // Check for new events and notify
      try {
        const knownIdsStr = await AsyncStorage.getItem("tbl_known_event_ids");
        const knownIds: number[] = knownIdsStr ? JSON.parse(knownIdsStr) : [];
        const currentIds = ev.map(e => e.id);
        if (knownIds.length > 0) {
          const newEvents = ev.filter(e => !knownIds.includes(e.id));
          for (const ne of newEvents.slice(0, 3)) {
            await notifyNewEvent(decodeHtmlEntities(ne.title.rendered), ne.id);
          }
        }
        await AsyncStorage.setItem("tbl_known_event_ids", JSON.stringify(currentIds));
      } catch {}
    } catch (e) {
      console.warn("Load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll hero carousel
  useEffect(() => {
    if (events.length < 2) return;
    const timer = setInterval(() => {
      setHeroIndex(i => {
        const next = (i + 1) % Math.min(upcomingEvents.length, 5);
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [events.length]);

  // Split events into upcoming and past
  const upcomingEvents = events.filter(isUpcoming);
  const pastEvents = events.filter(e => !isUpcoming(e));
  const heroEvents = upcomingEvents.slice(0, 5);

  if (loading) {
    return (
      <ScreenContainer edges={["left", "right"]} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Chargement...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
      >
        {/* GREETING */}
        {isAuthenticated && user && (
          <View style={styles.greetingContainer}>
            <Text style={[styles.greetingText, { color: colors.muted }]}>Bonjour, {user.firstName || user.displayName}</Text>
          </View>
        )}

        {/* HERO CAROUSEL */}
        {heroEvents.length > 0 && (
          <View style={{ height: HERO_H, marginBottom: 8 }}>
            <FlatList
              ref={heroRef}
              data={heroEvents}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => String(item.id)}
              getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              onMomentumScrollEnd={e => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/event/${item.id}` as any)}
                  style={{ width: SCREEN_W, height: HERO_H, paddingHorizontal: 16 }}
                >
                  <View style={styles.heroCard}>
                    <Image source={{ uri: item.featuredImage }} style={styles.heroImage} contentFit="cover" />
                    <View style={styles.heroOverlay}>
                      <Text style={styles.heroTitle} numberOfLines={1}>{decodeHtmlEntities(item.title.rendered)}</Text>
                      <View style={styles.heroMeta}>
                        <IconSymbol name="clock" size={14} color="#c79f6c" />
                        <Text style={styles.heroDate}>
                          {item.mobileFields?.event_date_time
                            ? formatDateShort(item.mobileFields.event_date_time)
                            : formatDateShort(item.date)}
                        </Text>
                        {item.minPrice != null && (
                          <Text style={styles.heroPrice}>
                            {item.minPrice === item.maxPrice
                              ? formatAriary(item.minPrice)
                              : `Dès ${formatAriary(item.minPrice)}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
            <View style={styles.dotsRow}>
              {heroEvents.map((_, i) => (
                <View key={i} style={[styles.dot, { width: heroIndex === i ? 20 : 6, backgroundColor: heroIndex === i ? colors.primary : colors.border }]} />
              ))}
            </View>
          </View>
        )}

        {/* UPCOMING EVENTS - FULL CARDS (same style as Events tab) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Événements à venir</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/events" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {/* CATEGORY FILTER - BEFORE EVENT CARDS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          <TouchableOpacity
            onPress={() => {
              setPendingCategory(null);
              router.push("/(tabs)/events" as any);
            }}
            style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={[styles.chipText, { color: "#fff" }]}>Tous</Text>
          </TouchableOpacity>
          {PARENT_CATEGORY_COLORS.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => {
                setPendingCategory(cat.label);
                router.push("/(tabs)/events" as any);
              }}
              style={[styles.chip, { backgroundColor: cat.color + "18", borderColor: cat.color }]}
            >
              <Text style={[styles.chipText, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ gap: 14 }}>
          {upcomingEvents.slice(0, 6).map(item => {
            const itemName = decodeHtmlEntities(item.title.rendered);
            const itemCats = item.categoryNames?.join(", ") || "";
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/event/${item.id}` as any)}
                style={[styles.eventCardFull, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={{ position: "relative" }}>
                  <Image source={{ uri: item.featuredImage }} style={styles.eventCardFullImage} contentFit="cover" />
                  <TouchableOpacity
                    onPress={() => toggleFavorite({ id: item.id, type: "event", name: itemName, image: item.featuredImage })}
                    style={styles.favBtn}
                  >
                    <IconSymbol name={isFavorite(item.id, "event") ? "heart.fill" : "heart"} size={18} color={isFavorite(item.id, "event") ? "#EF4444" : "#fff"} />
                  </TouchableOpacity>
                </View>
                <View style={styles.eventCardFullBody}>
                  <Text style={[styles.eventCardFullTitle, { color: colors.foreground }]} numberOfLines={2}>{itemName}</Text>
                  <View style={styles.eventCardFullMeta}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <IconSymbol name="clock" size={14} color={colors.muted} />
                      <Text style={[styles.eventCardFullMetaText, { color: colors.muted }]}>
                        {item.mobileFields?.event_date_time
                          ? formatDateShort(item.mobileFields.event_date_time)
                          : formatDateShort(item.date)}
                      </Text>
                    </View>
                    {itemCats ? (
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <IconSymbol name="tag.fill" size={14} color={colors.muted} />
                        <Text style={[styles.eventCardFullMetaText, { color: colors.muted }]} numberOfLines={1}>{itemCats}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.eventCardFullPriceRow}>
                    {item.minPrice != null ? (
                      <Text style={[styles.eventCardFullPrice, { color: colors.primary }]}>
                        {item.minPrice === item.maxPrice
                          ? formatAriary(item.minPrice)
                          : `Dès ${formatAriary(item.minPrice)}`}
                      </Text>
                    ) : (
                      <Text style={[styles.eventCardFullPrice, { color: colors.muted }]}>Prix non défini</Text>
                    )}
                    <View style={[styles.eventCardFullBtn, { backgroundColor: colors.primary }]}>
                      <Text style={styles.eventCardFullBtnText}>Voir</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PAST EVENTS - HORIZONTAL SCROLLER (same size as events tab: 220x120) */}
        {pastEvents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Événements passés</Text>
            </View>
            <FlatList
              data={pastEvents}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push(`/event/${item.id}` as any)}
                  style={[styles.pastEventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Image source={{ uri: item.featuredImage }} style={styles.pastEventImage} contentFit="cover" />
                  <View style={styles.pastEventBody}>
                    <Text style={[styles.pastEventTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {decodeHtmlEntities(item.title.rendered)}
                    </Text>
                    <Text style={[styles.pastEventDate, { color: colors.muted }]}>
                      {item.mobileFields?.event_date_time
                        ? formatDateShort(item.mobileFields.event_date_time)
                        : formatDateShort(item.date)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* SHOP HIGHLIGHTS */}
        {products.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <View style={styles.sectionHeaderInline}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Boutique</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/shop" as any)}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.shopGrid}>
              {products.slice(0, 4).map(p => (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/product/${p.id}` as any)}
                  style={[styles.shopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={{ position: "relative" }}>
                    <Image source={{ uri: p.images?.[0]?.src }} style={{ width: "100%", height: 120 }} contentFit="cover" />
                    <TouchableOpacity
                      onPress={() => toggleFavorite({ id: p.id, type: "product", name: decodeHtmlEntities(p.name), image: p.images?.[0]?.src })}
                      style={styles.favBtn}
                    >
                      <IconSymbol name={isFavorite(p.id, "product") ? "heart.fill" : "heart"} size={18} color={isFavorite(p.id, "product") ? "#EF4444" : "#fff"} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ padding: 10 }}>
                    <Text style={[styles.shopCardName, { color: colors.foreground }]} numberOfLines={2}>
                      {decodeHtmlEntities(p.name)}
                    </Text>
                    <Text style={[styles.shopCardPrice, { color: colors.primary }]}>{formatAriary(p.price)}</Text>
                    <PointsBadge price={p.price} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <OrganizerEventCta style={styles.organizerCta} />

        {/* LAMAKO REWARDS BANNER */}
        {isAuthenticated && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/rewards" as any)}
            style={{ marginHorizontal: 16, marginTop: 24 }}
          >
            <LinearGradient
              colors={["#663d17", "#8B5E34", "#c79f6c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rewardsBanner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardsBannerTitle}>LamakoRewards</Text>
                <Text style={styles.rewardsBannerSub}>
                  {rewardsState.availablePoints} pts • {currentTier.name}
                </Text>
              </View>
              <View style={styles.rewardsBannerIcon}>
                <RNImage source={require("@/assets/images/lamako-rewards-white.png")} style={{ width: 80, height: 30 }} resizeMode="contain" />
              </View>
              <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* LAMAKO REWARDS TEASER (for non-authenticated users) */}
        {!isAuthenticated && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/login" as any)}
            style={{ marginHorizontal: 16, marginTop: 24 }}
          >
            <LinearGradient
              colors={["#663d17", "#8B5E34", "#c79f6c"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rewardsBanner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardsBannerTitle}>LamakoRewards</Text>
                <Text style={styles.rewardsBannerSub}>
                  Gagnez des points à chaque achat
                </Text>
              </View>
              <View style={styles.rewardsBannerIcon}>
                <RNImage source={require("@/assets/images/lamako-rewards-white.png")} style={{ width: 80, height: 30 }} resizeMode="contain" />
              </View>
              <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* LOGIN CTA */}
        {!isAuthenticated && (
          <View style={[styles.loginCta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.loginCtaTitle, { color: colors.foreground }]}>Connectez-vous pour accéder à vos billets</Text>
            <Text style={[styles.loginCtaSub, { color: colors.muted }]}>Gérez vos commandes et billets QR depuis l'app</Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login" as any)}
              style={[styles.loginCtaButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.loginCtaButtonText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingText: { marginTop: 12, fontSize: 14 },
  greetingContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greetingText: { fontSize: 15, fontWeight: "600" },
  heroCard: { flex: 1, borderRadius: 16, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(0,0,0,0.5)" },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  heroMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  heroDate: { color: "#c79f6c", fontSize: 13, marginLeft: 4, fontWeight: "600" },
  heroPrice: { color: "#fff", fontSize: 13, marginLeft: "auto", fontWeight: "600" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 3 },
  chipsContainer: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { paddingHorizontal: 16, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionHeaderInline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 13, fontWeight: "600" },
  organizerCta: { marginHorizontal: 16, marginTop: 20 },
  // Full event cards (same as Events tab)
  eventCardFull: { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  eventCardFullImage: { width: "100%", height: 160 },
  eventCardFullBody: { padding: 14 },
  eventCardFullTitle: { fontSize: 16, fontWeight: "700" },
  eventCardFullMeta: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 12 },
  eventCardFullMetaText: { fontSize: 12, marginLeft: 4 },
  eventCardFullPriceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  eventCardFullPrice: { fontSize: 16, fontWeight: "700" },
  eventCardFullBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  eventCardFullBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  // Past events (horizontal scroller - same size as events tab: 220x120)
  pastEventCard: { width: 220, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  pastEventImage: { width: 220, height: 120 },
  pastEventBody: { padding: 10 },
  pastEventTitle: { fontSize: 13, fontWeight: "600" },
  pastEventDate: { fontSize: 11, marginTop: 4 },
  // Shop
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  shopCard: { width: (SCREEN_W - 44) / 2, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  shopCardName: { fontSize: 13, fontWeight: "600" },
  shopCardPrice: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  // Login CTA
  loginCta: { marginHorizontal: 16, marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 1 },
  loginCtaTitle: { fontSize: 16, fontWeight: "600" },
  loginCtaSub: { fontSize: 13, marginTop: 4 },
  loginCtaButton: { borderRadius: 12, paddingVertical: 12, marginTop: 14, alignItems: "center" },
  loginCtaButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Rewards
  rewardsBanner: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14 },
  rewardsBannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  rewardsBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  rewardsBannerIcon: { marginRight: 8 },
  favBtn: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
});

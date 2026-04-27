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
import { getEventsWithTickets, getShopProducts, type TCEvent, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary, formatDateShort, decodeHtmlEntities } from "@/lib/format";
import { useRewards } from "@/lib/rewards-provider";
import { useFavorites } from "@/lib/favorites-provider";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 220;

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

  const load = useCallback(async () => {
    try {
      const [ev, pr] = await Promise.all([getEventsWithTickets(), getShopProducts({ per_page: "6" })]);
      setEvents(ev);
      setProducts(pr);
    } catch (e) {
      console.warn("Load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (events.length < 2) return;
    const timer = setInterval(() => {
      setHeroIndex(i => {
        const next = (i + 1) % Math.min(events.length, 5);
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [events.length]);

  const heroEvents = events.slice(0, 5);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
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
                          {formatDateShort(item.date)}
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

        {/* CATEGORY CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          {["Tous", "Spectacles", "Conférences", "Sport", "Foires"].map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => router.push("/(tabs)/events" as any)}
              style={[styles.chip, {
                backgroundColor: cat === "Tous" ? colors.primary : colors.surface,
                borderColor: cat === "Tous" ? colors.primary : colors.border,
              }]}
            >
              <Text style={[styles.chipText, { color: cat === "Tous" ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* UPCOMING EVENTS */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Événements à venir</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/events" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={events.slice(0, 10)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/event/${item.id}` as any)}
              style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ position: "relative" }}>
                <Image source={{ uri: item.featuredImage }} style={styles.eventCardImage} contentFit="cover" />
                <TouchableOpacity
                  onPress={() => toggleFavorite({ id: item.id, type: "event", name: decodeHtmlEntities(item.title.rendered), image: item.featuredImage })}
                  style={styles.favBtn}
                >
                  <IconSymbol name={isFavorite(item.id, "event") ? "heart.fill" : "heart"} size={18} color={isFavorite(item.id, "event") ? "#EF4444" : "#fff"} />
                </TouchableOpacity>
              </View>
              <View style={styles.eventCardBody}>
                <Text style={[styles.eventCardTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {decodeHtmlEntities(item.title.rendered)}
                </Text>
                <Text style={[styles.eventCardDate, { color: colors.muted }]}>
                  {formatDateShort(item.date)}
                </Text>
                {item.minPrice != null && (
                  <Text style={[styles.eventCardPrice, { color: colors.primary }]}>
                    {item.minPrice === item.maxPrice
                      ? formatAriary(item.minPrice)
                      : `Dès ${formatAriary(item.minPrice)}`}
                  </Text>
                )}
                {item.hasSeatingChart && (
                  <View style={styles.seatingBadge}>
                    <IconSymbol name="mappin" size={10} color="#c79f6c" />
                    <Text style={styles.seatingBadgeText}>Plan de salle</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />

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
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

        {/* LAMAKO REWARDS INFO SECTION (for all users) */}
        <View style={{ marginHorizontal: 16, marginTop: 28 }}>
          <View style={styles.sectionHeaderInline}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>LamakoRewards</Text>
          </View>
          <LinearGradient
            colors={["#663d17", "#8B5E34"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rewardsInfoCard}
          >
            <View style={styles.rewardsInfoHeader}>
              <RNImage source={require("@/assets/images/lamako-rewards-white.png")} style={{ width: 100, height: 36 }} resizeMode="contain" />
              <Text style={styles.rewardsInfoBadge}>Programme de fidélité</Text>
            </View>
            <Text style={styles.rewardsInfoDesc}>
              Gagnez des points à chaque achat de billets et de goodies. Échangez-les contre des réductions, des accès VIP et des cadeaux exclusifs.
            </Text>
            <View style={styles.rewardsInfoGrid}>
              <View style={styles.rewardsInfoItem}>
                <Text style={styles.rewardsInfoEmoji}>🎫</Text>
                <Text style={styles.rewardsInfoItemTitle}>Achetez</Text>
                <Text style={styles.rewardsInfoItemSub}>1 Ar = 1 point</Text>
              </View>
              <View style={styles.rewardsInfoItem}>
                <Text style={styles.rewardsInfoEmoji}>⭐</Text>
                <Text style={styles.rewardsInfoItemTitle}>Cumulez</Text>
                <Text style={styles.rewardsInfoItemSub}>Montez en niveau</Text>
              </View>
              <View style={styles.rewardsInfoItem}>
                <Text style={styles.rewardsInfoEmoji}>🎁</Text>
                <Text style={styles.rewardsInfoItemTitle}>Profitez</Text>
                <Text style={styles.rewardsInfoItemSub}>Réductions & VIP</Text>
              </View>
            </View>
            <View style={styles.rewardsTiers}>
              {["Bronze", "Argent", "Or", "Platine"].map((tier, i) => (
                <View key={tier} style={[styles.rewardsTierPill, { backgroundColor: "rgba(255,255,255," + (0.1 + i * 0.05) + ")" }]}>
                  <Text style={styles.rewardsTierText}>{tier}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
          {isAuthenticated ? (
            <TouchableOpacity
              onPress={() => router.push("/rewards" as any)}
              style={[styles.rewardsCtaBtn, { backgroundColor: "#663d17" }]}
              activeOpacity={0.8}
            >
              <Text style={styles.rewardsCtaBtnText}>Voir mes récompenses</Text>
              <IconSymbol name="chevron.right" size={14} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login" as any)}
              style={[styles.rewardsCtaBtn, { backgroundColor: "#663d17" }]}
              activeOpacity={0.8}
            >
              <Text style={styles.rewardsCtaBtnText}>Connectez-vous pour commencer</Text>
              <IconSymbol name="chevron.right" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

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
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: "Raleway-Medium" },
  greetingContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greetingText: { fontSize: 13, fontFamily: "Raleway-Medium" },
  heroCard: { flex: 1, borderRadius: 16, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(0,0,0,0.5)" },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "Raleway-Bold" },
  heroMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  heroDate: { color: "#c79f6c", fontSize: 13, marginLeft: 4, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  heroPrice: { color: "#fff", fontSize: 13, marginLeft: "auto", fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 3 },
  chipsContainer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  sectionHeader: { paddingHorizontal: 16, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionHeaderInline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Raleway-Bold" },
  seeAll: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  eventCard: { width: 180, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  eventCardImage: { width: 180, height: 120 },
  eventCardBody: { padding: 10 },
  eventCardTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  eventCardDate: { fontSize: 12, marginTop: 4, fontFamily: "Raleway-Regular" },
  eventCardPrice: { fontSize: 14, fontWeight: "700", marginTop: 4, fontFamily: "Raleway-Bold" },
  seatingBadge: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  seatingBadgeText: { fontSize: 10, color: "#c79f6c", fontFamily: "Raleway-Medium" },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  shopCard: { width: (SCREEN_W - 44) / 2, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  shopCardName: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  shopCardPrice: { fontSize: 14, fontWeight: "700", marginTop: 4, fontFamily: "Raleway-Bold" },
  loginCta: { marginHorizontal: 16, marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 1 },
  loginCtaTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  loginCtaSub: { fontSize: 13, marginTop: 4, fontFamily: "Raleway-Regular" },
  loginCtaButton: { borderRadius: 12, paddingVertical: 12, marginTop: 14, alignItems: "center" },
  loginCtaButtonText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  rewardsBanner: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14 },
  rewardsBannerTitle: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  rewardsBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2, fontFamily: "Raleway-Medium" },
  rewardsBannerIcon: { marginRight: 8 },
  favBtn: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  rewardsInfoCard: { borderRadius: 16, padding: 20, overflow: "hidden" },
  rewardsInfoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  rewardsInfoBadge: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Raleway-Medium", backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rewardsInfoDesc: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 20, fontFamily: "Raleway-Regular", marginBottom: 18 },
  rewardsInfoGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  rewardsInfoItem: { alignItems: "center", flex: 1 },
  rewardsInfoEmoji: { fontSize: 24, marginBottom: 6 },
  rewardsInfoItemTitle: { color: "#fff", fontSize: 13, fontWeight: "700", fontFamily: "Raleway-Bold" },
  rewardsInfoItemSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Raleway-Regular", marginTop: 2 },
  rewardsTiers: { flexDirection: "row", justifyContent: "center", gap: 8 },
  rewardsTierPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  rewardsTierText: { color: "#fff", fontSize: 11, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  rewardsCtaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 10 },
  rewardsCtaBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Raleway-Bold" },
});

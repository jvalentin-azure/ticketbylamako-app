import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image as RNImage,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { CatalogImage } from "@/components/catalog-image";
import { EventPosterCard } from "@/components/event-poster-card";
import { HomeCatalogSkeleton } from "@/components/home-catalog-skeleton";
import { OrganizerEventCta } from "@/components/organizer-event-cta";
import { PointsBadge } from "@/components/points-badge";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PARENT_CATEGORY_COLORS } from "@/constants/category-colors";
import { useColors } from "@/hooks/use-colors";
import { getHomeData, type TCEvent, type WCProduct } from "@/lib/api/catalog";
import { useAuth } from "@/lib/auth-provider";
import { prefetchCatalogImages } from "@/lib/catalog-image-prefetch";
import { useFavorites } from "@/lib/favorites-provider";
import { setPendingCategory } from "@/lib/filter-state";
import { decodeHtmlEntities, formatAriary } from "@/lib/format";
import { formatEventDateShort, getEventStartDate } from "@/lib/event-date";
import { notifyNewEvent } from "@/lib/notifications";
import { useRewards } from "@/lib/rewards-provider";

const HERO_HEIGHT = 228;

function isUpcoming(event: TCEvent): boolean {
  if (
    event.salesClosed ||
    event.isPastEvent ||
    event.ticketingStatus === "ended"
  )
    return false;
  const date = getEventStartDate(event);
  return date ? date.getTime() > Date.now() : true;
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isAuthenticated, user } = useAuth();
  const { state: rewards, currentTier } = useRewards();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<FlatList<TCEvent>>(null);

  const upcoming = useMemo(() => events.filter(isUpcoming), [events]);
  const past = useMemo(
    () => events.filter((event) => !isUpcoming(event)),
    [events],
  );
  const heroes = useMemo(() => upcoming.slice(0, 5), [upcoming]);
  const posterWidth = Math.min(264, Math.max(224, width * 0.68));
  const productWidth = Math.max(150, (width - 44) / 2);

  const rememberEvents = useCallback(async (items: TCEvent[]) => {
    try {
      const raw = await AsyncStorage.getItem("tbl_known_event_ids");
      const known: number[] = raw ? JSON.parse(raw) : [];
      if (known.length) {
        for (const item of items
          .filter((event) => !known.includes(event.id))
          .slice(0, 3)) {
          await notifyNewEvent(
            decodeHtmlEntities(item.title.rendered),
            item.id,
          );
        }
      }
      await AsyncStorage.setItem(
        "tbl_known_event_ids",
        JSON.stringify(items.map((item) => item.id)),
      );
    } catch {
      // Notification bookkeeping must never block the catalogue.
    }
  }, []);

  const load = useCallback(
    async (forceRefresh = false) => {
      setError(null);
      try {
        const data = await getHomeData({ forceRefresh });
        void prefetchCatalogImages(
          data.events
            .filter(isUpcoming)
            .map(
              (event) =>
                event.featuredImageVariants?.webp ||
                event.featuredImageVariants?.avif ||
                event.featuredImage,
            ),
        );
        setEvents(data.events);
        setProducts(data.products);
        void rememberEvents(data.events);
      } catch {
        setError(
          "Impossible de charger les événements. Vérifiez votre connexion puis réessayez.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [rememberEvents],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (heroes.length < 2) return;
    const timer = setInterval(() => {
      setHeroIndex((current) => {
        const next = (current + 1) % heroes.length;
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [heroes.length]);

  if (loading) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <HomeCatalogSkeleton />
      </ScreenContainer>
    );
  }

  if (error && events.length === 0) {
    return (
      <ScreenContainer edges={["left", "right"]} className="flex-1">
        <View style={styles.errorState}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={34}
            color={colors.primary}
          />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Catalogue indisponible
          </Text>
          <Text style={[styles.errorMessage, { color: colors.muted }]}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réessayer de charger les événements"
            onPress={() => {
              setLoading(true);
              void load(true);
            }}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color="#fff" />
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {isAuthenticated && user ? (
          <Text style={[styles.greeting, { color: colors.muted }]}>
            Bonjour, {user.firstName || user.displayName}
          </Text>
        ) : null}

        {heroes.length ? (
          <View style={styles.heroSection}>
            <FlatList
              ref={heroRef}
              data={heroes}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => String(item.id)}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onMomentumScrollEnd={(event) =>
                setHeroIndex(
                  Math.round(event.nativeEvent.contentOffset.x / width),
                )
              }
              renderItem={({ item }) => (
                <Hero
                  event={item}
                  width={width}
                  onPress={() => router.push(`/event/${item.id}` as never)}
                />
              )}
            />
            <View
              style={styles.dots}
              accessibilityLabel={`Visuel ${heroIndex + 1} sur ${heroes.length}`}
            >
              {heroes.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === heroIndex ? colors.primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <SectionHeader
          title="Événements à venir"
          action="Voir tout"
          onAction={() => router.push("/(tabs)/events" as never)}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <CategoryChip
            label="Tous"
            color={colors.primary}
            onPress={() => {
              setPendingCategory(null);
              router.push("/(tabs)/events" as never);
            }}
          />
          {PARENT_CATEGORY_COLORS.map((category) => (
            <CategoryChip
              key={category.id}
              label={`${category.emoji} ${category.label}`}
              color={category.color}
              onPress={() => {
                setPendingCategory(category.label);
                router.push("/(tabs)/events" as never);
              }}
            />
          ))}
        </ScrollView>

        {upcoming.length ? (
          <FlatList
            data={upcoming.slice(0, 8)}
            horizontal
            initialNumToRender={3}
            windowSize={4}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posterList}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <EventPosterCard
                event={item}
                width={posterWidth}
                favorite={isFavorite(item.id, "event")}
                onPress={() => router.push(`/event/${item.id}` as never)}
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
        ) : (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Aucun événement à venir.
          </Text>
        )}

        {past.length ? (
          <>
            <SectionHeader title="Événements passés" />
            <FlatList
              data={past.slice(0, 10)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pastList}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <PastEvent
                  event={item}
                  onPress={() => router.push(`/event/${item.id}` as never)}
                />
              )}
            />
          </>
        ) : null}

        {products.length ? (
          <View style={styles.shopSection}>
            <SectionHeader
              compact
              title="Boutique"
              action="Voir tout"
              onAction={() => router.push("/(tabs)/shop" as never)}
            />
            <View style={styles.shopGrid}>
              {products.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  width={productWidth}
                  favorite={isFavorite(product.id, "product")}
                  onPress={() => router.push(`/product/${product.id}` as never)}
                  onFavorite={() =>
                    toggleFavorite({
                      id: product.id,
                      type: "product",
                      name: decodeHtmlEntities(product.name),
                      image: product.images?.[0]?.src,
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        <OrganizerEventCta style={styles.organizerCta} />
        <RewardsBanner
          authenticated={isAuthenticated}
          points={rewards.availablePoints}
          tier={currentTier.name}
          onPress={() =>
            router.push(
              (isAuthenticated ? "/rewards" : "/(auth)/login") as never,
            )
          }
        />
        {!isAuthenticated ? (
          <LoginCta onPress={() => router.push("/(auth)/login" as never)} />
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Hero({
  event,
  width,
  onPress,
}: {
  event: TCEvent;
  width: number;
  onPress: () => void;
}) {
  const title = decodeHtmlEntities(event.title.rendered);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${title}`}
      onPress={onPress}
      style={{ width, height: HERO_HEIGHT, paddingHorizontal: 16 }}
    >
      <View style={styles.heroCard}>
        <CatalogImage
          uri={event.featuredImage}
          optimizedUri={
            event.featuredImageVariants?.webp ||
            event.featuredImageVariants?.avif
          }
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Affiche de ${title}`}
          recyclingKey={`hero-${event.id}`}
        />
        <LinearGradient
          colors={["transparent", "rgba(9,10,15,0.92)"]}
          style={styles.heroOverlay}
        >
          <Text style={styles.heroTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.heroMeta}>
            <IconSymbol name="clock" size={14} color="#E7B64A" />
            <Text style={styles.heroDate}>{formatEventDateShort(event)}</Text>
            {event.minPrice != null ? (
              <Text style={styles.heroPrice}>
                {event.minPrice === event.maxPrice
                  ? formatAriary(event.minPrice)
                  : `Dès ${formatAriary(event.minPrice)}`}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
  compact,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}
    >
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CategoryChip({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtrer par ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: color,
          backgroundColor: `${color}18`,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function PastEvent({
  event,
  onPress,
}: {
  event: TCEvent;
  onPress: () => void;
}) {
  const colors = useColors();
  const title = decodeHtmlEntities(event.title.rendered);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir l'événement passé ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pastCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <CatalogImage
        uri={event.featuredImage}
        optimizedUri={
          event.featuredImageVariants?.webp || event.featuredImageVariants?.avif
        }
        style={styles.pastImage}
        accessibilityLabel={`Affiche de ${title}`}
        recyclingKey={`past-${event.id}`}
      />
      <View style={styles.pastBody}>
        <Text
          style={[styles.pastTitle, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={[styles.pastDate, { color: colors.muted }]}>
          {formatEventDateShort(event)}
        </Text>
      </View>
    </Pressable>
  );
}

function ProductCard({
  product,
  width,
  favorite,
  onPress,
  onFavorite,
}: {
  product: WCProduct;
  width: number;
  favorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}) {
  const colors = useColors();
  const title = decodeHtmlEntities(product.name);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir ${title}, ${formatAriary(product.price)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.productCard,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.productMedia}>
        <CatalogImage
          uri={product.images?.[0]?.src}
          optimizedUri={
            product.images?.[0]?.variants?.webp ||
            product.images?.[0]?.variants?.avif
          }
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Photo de ${title}`}
          recyclingKey={`product-${product.id}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            favorite ? "Retirer des favoris" : "Ajouter aux favoris"
          }
          onPress={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          style={styles.favorite}
        >
          <IconSymbol
            name={favorite ? "heart.fill" : "heart"}
            size={18}
            color={favorite ? "#EF4444" : "#fff"}
          />
        </Pressable>
      </View>
      <View style={styles.productBody}>
        <Text
          style={[styles.productName, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={[styles.productPrice, { color: colors.primary }]}>
          {formatAriary(product.price)}
        </Text>
        {product.lamakoRewardsEnabled !== false ? (
          <PointsBadge price={product.price} />
        ) : null}
      </View>
    </Pressable>
  );
}

function RewardsBanner({
  authenticated,
  points,
  tier,
  onPress,
}: {
  authenticated: boolean;
  points: number;
  tier: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir LamakoRewards"
      onPress={onPress}
      style={styles.rewardsWrap}
    >
      <LinearGradient
        colors={["#4E2C13", "#83511F", "#C99A54"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.rewardsBanner}
      >
        <View style={styles.rewardsCopy}>
          <Text style={styles.rewardsTitle}>LamakoRewards</Text>
          <Text style={styles.rewardsSubtitle}>
            {authenticated
              ? `${points} pts · ${tier}`
              : "Cumulez des points à chaque achat"}
          </Text>
        </View>
        <RNImage
          source={require("@/assets/images/lamako-rewards-white.png")}
          style={styles.rewardsLogo}
          resizeMode="contain"
        />
        <IconSymbol name="chevron.right" size={18} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

function LoginCta({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.loginCta,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.loginTitle, { color: colors.foreground }]}>
        Vos billets, toujours avec vous
      </Text>
      <Text style={[styles.loginSubtitle, { color: colors.muted }]}>
        Connectez-vous pour retrouver vos commandes et QR codes.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.loginButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={styles.loginButtonText}>Se connecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
    fontSize: 15,
    fontWeight: "600",
  },
  heroSection: { height: HERO_HEIGHT + 22, marginTop: 4 },
  heroCard: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#101116",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 16,
  },
  heroTitle: { color: "#fff", fontSize: 20, lineHeight: 25, fontWeight: "800" },
  heroMeta: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  heroDate: {
    color: "#E7B64A",
    fontSize: 13,
    marginLeft: 5,
    fontWeight: "700",
  },
  heroPrice: {
    color: "#fff",
    fontSize: 13,
    marginLeft: "auto",
    fontWeight: "700",
  },
  dots: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderCompact: { paddingHorizontal: 0, marginTop: 0 },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  sectionAction: { fontSize: 14, fontWeight: "700" },
  chips: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  posterList: { paddingHorizontal: 16, gap: 12 },
  emptyText: { paddingHorizontal: 16, paddingVertical: 24, fontSize: 14 },
  pastList: { paddingHorizontal: 16, gap: 12 },
  pastCard: { width: 220, borderRadius: 8, overflow: "hidden", borderWidth: 1 },
  pastImage: { width: 220, height: 124 },
  pastBody: { padding: 11 },
  pastTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  pastDate: { fontSize: 11, marginTop: 5 },
  shopSection: { marginTop: 26, paddingHorizontal: 16 },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  productCard: { borderRadius: 8, overflow: "hidden", borderWidth: 1 },
  productMedia: { width: "100%", aspectRatio: 1, position: "relative" },
  favorite: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17,19,24,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  productBody: { padding: 11 },
  productName: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  productPrice: { fontSize: 15, fontWeight: "800", marginTop: 6 },
  organizerCta: { marginHorizontal: 16, marginTop: 24 },
  rewardsWrap: { marginHorizontal: 16, marginTop: 24 },
  rewardsBanner: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
  },
  rewardsCopy: { flex: 1 },
  rewardsTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rewardsSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    marginTop: 3,
  },
  rewardsLogo: { width: 76, height: 30, marginRight: 8 },
  loginCta: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
  },
  loginTitle: { fontSize: 16, fontWeight: "800" },
  loginSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  loginButton: {
    minHeight: 48,
    borderRadius: 8,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  errorState: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: { fontSize: 20, fontWeight: "800", marginTop: 14 },
  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 18,
  },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  bottomSpace: { height: 40 },
});

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { goBackOrFallback } from "@/lib/navigation";
import { CatalogImage } from "@/components/catalog-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getEventsData,
  getShopData,
  type TCEvent,
  type WCProduct,
} from "@/lib/api/catalog";
import { formatAriary, decodeHtmlEntities } from "@/lib/format";
import { formatEventDateShort } from "@/lib/event-date";
import { PointsBadge } from "@/components/points-badge";

type TabType = "all" | "events" | "products";

interface SearchResult {
  id: number;
  type: "event" | "product";
  title: string;
  image?: string;
  subtitle: string;
  price?: string;
  lamakoRewardsEnabled?: boolean;
}

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const dataRequestId = useRef(0);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabType>("all");
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // Auto-focus the search input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const loadSearchData = useCallback(async (forceRefresh = false) => {
    const activeRequest = ++dataRequestId.current;
    setDataLoading(true);
    setDataError("");
    try {
      const [{ events: evts }, { products: prods }] = await Promise.all([
        getEventsData({ forceRefresh }),
        getShopData({ forceRefresh }),
      ]);
      if (dataRequestId.current !== activeRequest) return;
      setEvents(evts);
      setProducts(prods);
    } catch {
      if (dataRequestId.current !== activeRequest) return;
      setDataError(
        "La recherche est momentanément indisponible. Vérifiez votre connexion.",
      );
    } finally {
      if (dataRequestId.current === activeRequest) setDataLoading(false);
    }
  }, []);

  // Load all data once on mount for fast local filtering.
  useEffect(() => {
    void loadSearchData();
    return () => {
      dataRequestId.current += 1;
    };
  }, [loadSearchData]);

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredEvents: SearchResult[] =
    query.length >= 2
      ? events
          .filter((e) =>
            normalize(decodeHtmlEntities(e.title.rendered)).includes(
              normalize(query),
            ),
          )
          .map((e) => ({
            id: e.id,
            type: "event" as const,
            title: decodeHtmlEntities(e.title.rendered),
            image: e.featuredImage,
            subtitle: e.categoryNames?.join(", ") || formatEventDateShort(e),
            lamakoRewardsEnabled: e.lamakoRewardsEnabled !== false,
            price: e.minPrice ? `Dès ${formatAriary(e.minPrice)}` : undefined,
          }))
      : [];

  const filteredProducts: SearchResult[] =
    query.length >= 2
      ? products
          .filter((p) =>
            normalize(decodeHtmlEntities(p.name)).includes(normalize(query)),
          )
          .map((p) => ({
            id: p.id,
            type: "product" as const,
            title: decodeHtmlEntities(p.name),
            image: p.images?.[0]?.src,
            subtitle: p.categories?.map((c) => c.name).join(", ") || "Boutique",
            lamakoRewardsEnabled: p.lamakoRewardsEnabled !== false,
            price: p.price ? formatAriary(parseFloat(p.price)) : undefined,
          }))
      : [];

  const results =
    tab === "events"
      ? filteredEvents
      : tab === "products"
        ? filteredProducts
        : [...filteredEvents, ...filteredProducts];

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length >= 2) setHasSearched(true);
  }, []);

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (item.type === "event") {
          router.push(`/event/${item.id}` as any);
        } else {
          router.push(`/product/${item.id}` as any);
        }
      }}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {item.image ? (
        <CatalogImage
          uri={item.image}
          style={styles.cardImage}
          accessibilityLabel={`Affiche de ${item.title}`}
          recyclingKey={`search-${item.type}-${item.id}`}
        />
      ) : (
        <View
          style={[
            styles.cardImagePlaceholder,
            { backgroundColor: colors.border },
          ]}
        >
          <IconSymbol
            name={item.type === "event" ? "calendar" : "bag.fill"}
            size={24}
            color={colors.muted}
          />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === "event" ? colors.primary + "20" : "#c79f6c20",
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: item.type === "event" ? colors.primary : "#c79f6c" },
              ]}
            >
              {item.type === "event" ? "Événement" : "Produit"}
            </Text>
          </View>
        </View>
        <Text
          style={[styles.cardTitle, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.cardFooter}>
          <Text
            style={[styles.cardSubtitle, { color: colors.muted }]}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
          {item.price && (
            <Text style={[styles.cardPrice, { color: colors.primary }]}>
              {item.price}
            </Text>
          )}
        </View>
        {item.price && item.lamakoRewardsEnabled !== false && (
          <PointsBadge price={item.price.replace(/[^0-9]/g, "")} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => goBackOrFallback(router, "/(tabs)/")}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Recherche
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Rechercher événements, produits..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setHasSearched(false);
            }}
          >
            <IconSymbol
              name="xmark.circle.fill"
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      {hasSearched && (
        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {[
            {
              key: "all" as TabType,
              label: "Tous",
              count: filteredEvents.length + filteredProducts.length,
            },
            {
              key: "events" as TabType,
              label: "Événements",
              count: filteredEvents.length,
            },
            {
              key: "products" as TabType,
              label: "Produits",
              count: filteredProducts.length,
            },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                tab === t.key && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: tab === t.key ? colors.primary : colors.muted,
                    fontWeight: tab === t.key ? "700" : "400",
                  },
                ]}
              >
                {t.label} ({t.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {!hasSearched ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="magnifyingglass" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Rechercher
          </Text>
          <Text style={[styles.emptySubText, { color: colors.muted }]}>
            Tapez au moins 2 caractères pour rechercher des événements et
            produits
          </Text>
        </View>
      ) : dataLoading ? (
        <View style={styles.searchLoading}>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={[
                styles.searchSkeleton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.searchSkeletonImage,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.searchSkeletonBody}>
                <View
                  style={[
                    styles.searchSkeletonLine,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View
                  style={[
                    styles.searchSkeletonLine,
                    styles.searchSkeletonLineShort,
                    { backgroundColor: colors.border },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : dataError ? (
        <View style={styles.emptyContainer}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={42}
            color={colors.primary}
          />
          <Text style={[styles.emptyText, { color: colors.foreground }]}>
            Recherche indisponible
          </Text>
          <Text style={[styles.emptySubText, { color: colors.muted }]}>
            {dataError}
          </Text>
          <TouchableOpacity
            onPress={() => void loadSearchData(true)}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Réessayer le chargement de la recherche"
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderResult}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol
                name="magnifyingglass"
                size={48}
                color={colors.muted}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Aucun résultat
              </Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>
                Aucun événement ou produit ne correspond à "{query}"
              </Text>
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
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  searchLoading: { padding: 16, gap: 12 },
  searchSkeleton: {
    height: 102,
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchSkeletonImage: { width: 100, height: 100 },
  searchSkeletonBody: { flex: 1, padding: 14, gap: 12 },
  searchSkeletonLine: { height: 14, width: "82%", borderRadius: 5 },
  searchSkeletonLineShort: { width: "48%" },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },
  cardImage: {
    width: 100,
    height: 100,
  },
  cardImagePlaceholder: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardSubtitle: {
    fontSize: 11,
    flex: 1,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 48,
    minWidth: 180,
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

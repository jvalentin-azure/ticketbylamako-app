import { useState, useEffect, useCallback, useRef } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getHomeData, type TCEvent, type WCProduct } from "@/lib/api/catalog";
import { formatAriary, decodeHtmlEntities, formatDateShort } from "@/lib/format";
import { PointsBadge } from "@/components/points-badge";

type TabType = "all" | "events" | "products";

interface SearchResult {
  id: number;
  type: "event" | "product";
  title: string;
  image?: string;
  subtitle: string;
  price?: string;
}

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabType>("all");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-focus the search input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Load all data once on mount for local filtering
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { events: evts, products: prods } = await getHomeData();
        if (!cancelled) {
          setEvents(evts);
          setProducts(prods);
        }
      } catch (e) {
        console.error("Search data load error:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredEvents: SearchResult[] = query.length >= 2
    ? events
        .filter((e) => normalize(decodeHtmlEntities(e.title.rendered)).includes(normalize(query)))
        .map((e) => ({
          id: e.id,
          type: "event" as const,
          title: decodeHtmlEntities(e.title.rendered),
          image: e.featuredImage,
          subtitle: e.categoryNames?.join(", ") || formatDateShort(e.date),
          price: e.minPrice ? `Dès ${formatAriary(e.minPrice)}` : undefined,
        }))
    : [];

  const filteredProducts: SearchResult[] = query.length >= 2
    ? products
        .filter((p) => normalize(decodeHtmlEntities(p.name)).includes(normalize(query)))
        .map((p) => ({
          id: p.id,
          type: "product" as const,
          title: decodeHtmlEntities(p.name),
          image: p.images?.[0]?.src,
          subtitle: p.categories?.map((c) => c.name).join(", ") || "Boutique",
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
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}>
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
          <Text style={[styles.cardSubtitle, { color: colors.muted }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
          {item.price && (
            <Text style={[styles.cardPrice, { color: colors.primary }]}>{item.price}</Text>
          )}
        </View>
        {item.price && <PointsBadge price={item.price.replace(/[^0-9]/g, '')} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Recherche</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          <TouchableOpacity onPress={() => { setQuery(""); setHasSearched(false); }}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      {hasSearched && (
        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          {([
            { key: "all" as TabType, label: "Tous", count: filteredEvents.length + filteredProducts.length },
            { key: "events" as TabType, label: "Événements", count: filteredEvents.length },
            { key: "products" as TabType, label: "Produits", count: filteredProducts.length },
          ]).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
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
            Tapez au moins 2 caractères pour rechercher des événements et produits
          </Text>
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
              <IconSymbol name="magnifyingglass" size={48} color={colors.muted} />
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
});

import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Dimensions, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getShopData, type WCProduct, type WCCategory } from "@/lib/api/catalog";
import { formatAriary, decodeHtmlEntities } from "@/lib/format";
import { useFavorites } from "@/lib/favorites-provider";
import { PointsBadge } from "@/components/points-badge";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 48) / 2;

// Boutique parent category slugs to filter from API
const BOUTIQUE_SLUGS = ["boutique-goodies", "boutique-livres-supports", "boutique-affiches-visuels", "boutique-packs", "boutique-promotions"];

export default function ShopScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [categories, setCategories] = useState<WCCategory[]>([]);
  const [shopCats, setShopCats] = useState<{ id: number; name: string; color: string }[]>([]);
  const [filtered, setFiltered] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      // Single optimized endpoint - ~3x faster than separate WC API calls
      const { products: p, categories: cats } = await getShopData();
      setProducts(p);
      setCategories(cats);
      // Build shop category chips from API data with colors
      const SHOP_CAT_COLORS: Record<string, string> = {
        "boutique-goodies": "#FF9800",
        "boutique-livres-supports": "#2196F3",
        "boutique-affiches-visuels": "#9C27B0",
        "boutique-packs": "#4CAF50",
        "boutique-promotions": "#F44336",
      };
      const boutiqueCats = cats
        .filter(c => c.slug?.startsWith("boutique-") && c.parent === 0)
        .map(c => ({
          id: c.id,
          name: decodeHtmlEntities(c.name).replace(/^Boutique\s*[–-]\s*/i, ""),
          color: SHOP_CAT_COLORS[c.slug] || "#607D8B",
        }));
      setShopCats(boutiqueCats);
      setFiltered(p);
    } catch (e) {
      console.warn("Shop load error:", e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = products;
    if (selectedCat) {
      result = result.filter(p => p.categories?.some(c => c.id === selectedCat));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => decodeHtmlEntities(p.name).toLowerCase().includes(q));
    }
    setFiltered(result);
  }, [search, products, selectedCat]);

  const renderProduct = ({ item }: { item: WCProduct }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/product/${item.id}` as any)}
      style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={{ position: "relative" }}>
        <Image source={{ uri: item.images?.[0]?.src }} style={{ width: CARD_W, height: CARD_W }} contentFit="cover" />
        <TouchableOpacity
          onPress={() => toggleFavorite({ id: item.id, type: "product", name: decodeHtmlEntities(item.name), image: item.images?.[0]?.src })}
          style={styles.favBtn}
        >
          <IconSymbol name={isFavorite(item.id, "product") ? "heart.fill" : "heart"} size={16} color={isFavorite(item.id, "product") ? "#EF4444" : "#fff"} />
        </TouchableOpacity>
      </View>
      <View style={styles.productBody}>
        <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>{decodeHtmlEntities(item.name)}</Text>
        <Text style={[styles.productCat, { color: colors.muted }]} numberOfLines={1}>
          {item.categories?.filter(c => c.slug.startsWith("boutique-")).map(c => decodeHtmlEntities(c.name)).join(", ") || ""}
        </Text>
        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatAriary(item.price)}</Text>
        {item.lamakoRewardsEnabled !== false && <PointsBadge price={item.price} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Boutique</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          placeholder="Rechercher un produit..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      {/* Category Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chipsContainer}>
        <TouchableOpacity
          onPress={() => setSelectedCat(null)}
          style={[styles.chip, {
            backgroundColor: !selectedCat ? colors.primary : colors.surface,
            borderColor: !selectedCat ? colors.primary : colors.border,
          }]}
        >
          <Text style={[styles.chipText, { color: !selectedCat ? "#fff" : colors.foreground }]}>Tous</Text>
        </TouchableOpacity>
        {shopCats.map(cat => {
          const isSelected = selectedCat === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCat(isSelected ? null : cat.id)}
              style={[styles.chip, {
                backgroundColor: isSelected ? cat.color : cat.color + "18",
                borderColor: cat.color,
              }]}
            >
              <Text style={[styles.chipText, { color: isSelected ? "#fff" : cat.color }]}>{cat.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productListContent}
          keyExtractor={item => String(item.id)}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="bag.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun produit trouvé</Text>
              <Text style={[styles.emptySubText, { color: colors.muted }]}>La boutique sera bientôt disponible</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  searchBar: { marginHorizontal: 16, marginBottom: 0, flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 15 },
  chipsScroller: { flexGrow: 0, height: 48, maxHeight: 48 },
  chipsContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  columnWrapper: { paddingHorizontal: 16, gap: 12 },
  productListContent: { paddingTop: 4, paddingBottom: 24 },
  productCard: { width: CARD_W, borderRadius: 14, overflow: "hidden", borderWidth: 1, marginBottom: 12 },
  productBody: { padding: 10 },
  productName: { fontSize: 13, fontWeight: "600" },
  productCat: { fontSize: 11, marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, marginTop: 12 },
  emptySubText: { fontSize: 13, marginTop: 4 },
  favBtn: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
});

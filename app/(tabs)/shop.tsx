import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Dimensions, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getShopProducts, getShopCategories, type WCProduct, type WCCategory } from "@/lib/api/woocommerce";
import { formatAriary, decodeHtmlEntities } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 48) / 2;

// Main boutique parent categories
const BOUTIQUE_PARENTS = [
  { id: 123, name: "Goodies", icon: "bag.fill" as const },
  { id: 124, name: "Livres & Supports", icon: "book.fill" as const },
  { id: 125, name: "Affiches & Visuels", icon: "photo.fill" as const },
  { id: 126, name: "Packs", icon: "gift.fill" as const },
  { id: 127, name: "Promotions", icon: "tag.fill" as const },
];

export default function ShopScreen() {
  const colors = useColors();
  const router = useRouter();
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [categories, setCategories] = useState<WCCategory[]>([]);
  const [filtered, setFiltered] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, cats] = await Promise.all([
        getShopProducts({ per_page: "50" }),
        getShopCategories(),
      ]);
      setProducts(p);
      setCategories(cats);
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
      <Image source={{ uri: item.images?.[0]?.src }} style={{ width: CARD_W, height: CARD_W }} contentFit="cover" />
      <View style={styles.productBody}>
        <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>{decodeHtmlEntities(item.name)}</Text>
        <Text style={[styles.productCat, { color: colors.muted }]} numberOfLines={1}>
          {item.categories?.filter(c => c.slug.startsWith("boutique-")).map(c => decodeHtmlEntities(c.name)).join(", ") || ""}
        </Text>
        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatAriary(item.price)}</Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
        <TouchableOpacity
          onPress={() => setSelectedCat(null)}
          style={[styles.chip, {
            backgroundColor: !selectedCat ? colors.primary : colors.surface,
            borderColor: !selectedCat ? colors.primary : colors.border,
          }]}
        >
          <Text style={[styles.chipText, { color: !selectedCat ? "#fff" : colors.foreground }]}>Tous</Text>
        </TouchableOpacity>
        {BOUTIQUE_PARENTS.map(cat => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            style={[styles.chip, {
              backgroundColor: selectedCat === cat.id ? colors.primary : colors.surface,
              borderColor: selectedCat === cat.id ? colors.primary : colors.border,
            }]}
          >
            <Text style={[styles.chipText, { color: selectedCat === cat.id ? "#fff" : colors.foreground }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
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
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Raleway-Bold" },
  searchBar: { marginHorizontal: 16, marginBottom: 8, flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15, fontFamily: "Raleway-Regular" },
  chipsContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  columnWrapper: { paddingHorizontal: 16, gap: 12 },
  productCard: { width: CARD_W, borderRadius: 14, overflow: "hidden", borderWidth: 1, marginBottom: 12 },
  productBody: { padding: 10 },
  productName: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  productCat: { fontSize: 11, marginTop: 2, fontFamily: "Raleway-Regular" },
  productPrice: { fontSize: 15, fontWeight: "700", marginTop: 6, fontFamily: "Raleway-Bold" },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, marginTop: 12, fontFamily: "Raleway-Medium" },
  emptySubText: { fontSize: 13, marginTop: 4, fontFamily: "Raleway-Regular" },
});

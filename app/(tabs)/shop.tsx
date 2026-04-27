import { useEffect, useState, useCallback } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCart } from "@/lib/cart-provider";
import { getShopProducts, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 48) / 2;

export default function ShopScreen() {
  const colors = useColors();
  const router = useRouter();
  const { itemCount } = useCart();
  const [products, setProducts] = useState<WCProduct[]>([]);
  const [filtered, setFiltered] = useState<WCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await getShopProducts({ per_page: "50" });
      setProducts(p);
      setFiltered(p);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(products); return; }
    const q = search.toLowerCase();
    setFiltered(products.filter(p => p.name.toLowerCase().includes(q)));
  }, [search, products]);

  const renderProduct = ({ item }: { item: WCProduct }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/product/${item.id}` as any)}
      style={{ width: CARD_W, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}
    >
      <Image source={{ uri: item.images?.[0]?.src }} style={{ width: CARD_W, height: CARD_W }} contentFit="cover" />
      <View style={{ padding: 10 }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={2}>{item.name}</Text>
        <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 6 }}>{formatAriary(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Boutique</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/tickets" as any)} style={{ position: "relative" }}>
          <IconSymbol name="cart.fill" size={26} color={colors.foreground} />
          {itemCount > 0 && (
            <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: colors.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          placeholder="Rechercher un produit..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: colors.foreground, fontSize: 15 }}
        />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, gap: 12 }}
          keyExtractor={item => String(item.id)}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <IconSymbol name="bag.fill" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 15, marginTop: 12 }}>Aucun produit trouvé</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProduct, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary, stripHtml } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<WCProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    getProduct(Number(id)).then(p => { setProduct(p); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!product) return <ScreenContainer className="flex-1 items-center justify-center"><Text style={{ color: colors.muted }}>Produit introuvable</Text></ScreenContainer>;

  const desc = stripHtml(product.description || product.short_description || "");
  const images = product.images || [];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <Image source={{ uri: images[imgIdx]?.src }} style={{ width: SCREEN_W, height: SCREEN_W }} contentFit="cover" />
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: "absolute", top: 12, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
          {images.length > 1 && (
            <View style={{ flexDirection: "row", justifyContent: "center", position: "absolute", bottom: 12, left: 0, right: 0 }}>
              {images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setImgIdx(i)}>
                  <View style={{ width: imgIdx === i ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: imgIdx === i ? "#fff" : "rgba(255,255,255,0.5)", marginHorizontal: 3 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>{product.name}</Text>
          <Text style={{ color: colors.primary, fontSize: 26, fontWeight: "800", marginTop: 8 }}>{formatAriary(product.price)}</Text>
          {product.regular_price && product.sale_price && (
            <Text style={{ color: colors.muted, fontSize: 14, textDecorationLine: "line-through", marginTop: 2 }}>{formatAriary(product.regular_price)}</Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>Quantité</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <TouchableOpacity onPress={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>-</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" }}>{qty}</Text>
              <TouchableOpacity onPress={() => setQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {desc ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Description</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{desc}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: product.stock_status === "instock" ? colors.success : colors.error }} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>{product.stock_status === "instock" ? "En stock" : "Rupture de stock"}</Text>
          </View>
        </View>
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={() => {
            addItem({ productId: product.id, name: product.name, price: parseFloat(product.price) || 0, image: images[0]?.src || "", quantity: qty, isEvent: false });
            router.back();
          }}
          style={{ backgroundColor: product.stock_status === "instock" ? colors.primary : colors.muted, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
          disabled={product.stock_status !== "instock"}
        >
          <IconSymbol name="cart.fill" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Ajouter au panier - {formatAriary(parseFloat(product.price) * qty)}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

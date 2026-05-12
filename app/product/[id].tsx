import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProduct, type WCProduct } from "@/lib/api/catalog";
import { formatAriary, stripHtml, decodeHtmlEntities } from "@/lib/format";
import { PointsBadge } from "@/components/points-badge";
import { useRewards } from "@/lib/rewards-provider";
import { CartToast } from "@/components/cart-toast";

const { width: SCREEN_W } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<WCProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showCartToast, setShowCartToast] = useState(false);
  const [cartToastName, setCartToastName] = useState("");

  useEffect(() => {
    if (!id) return;
    getProduct(Number(id)).then(p => { setProduct(p); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!product) return <ScreenContainer className="flex-1 items-center justify-center"><Text style={{ color: colors.muted }}>Produit introuvable</Text></ScreenContainer>;

  // Mobile fields from the lamako-mobile-fields plugin
  const mobileFields = (product as any).lamako_mobile as { description: string | null; gallery: string[] | null; practical_info: { label: string; value: string }[] | null } | undefined;
  const mobileDesc = mobileFields?.description;
  const mobileGallery = mobileFields?.gallery;
  const practicalInfo = mobileFields?.practical_info;

  // Description: prefer mobile, fallback to site
  const siteDesc = stripHtml(product.short_description || product.description || "");
  const desc = mobileDesc || siteDesc;

  // Images: mobile gallery + WC product images
  const wcImages = product.images?.map(img => img.src) || [];
  const allImages: string[] = [];
  if (mobileGallery && mobileGallery.length > 0) {
    mobileGallery.forEach(img => { if (img) allImages.push(img); });
  }
  wcImages.forEach(img => { if (img && !allImages.includes(img)) allImages.push(img); });

  const productName = decodeHtmlEntities(product.name);
  const bottomSafePadding = Math.max(insets.bottom, 16) + 12;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <CartToast
        visible={showCartToast}
        itemName={cartToastName}
        onHide={() => setShowCartToast(false)}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.productScroll}
        contentContainerStyle={[styles.productScrollContent, { paddingBottom: bottomSafePadding + 24 }]}
      >
        {/* Image Gallery */}
        <View style={{ position: "relative" }}>
          {allImages.length > 1 ? (
            <View>
              <FlatList
                data={allImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                  setGalleryIndex(idx);
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={{ width: SCREEN_W, height: SCREEN_W * 0.85 }} contentFit="cover" />
                )}
              />
              {/* Gallery dots */}
              <View style={styles.galleryDots}>
                {allImages.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, { backgroundColor: i === galleryIndex ? "#fff" : "rgba(255,255,255,0.5)" }]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Image source={{ uri: allImages[0] }} style={{ width: SCREEN_W, height: SCREEN_W * 0.85 }} contentFit="cover" />
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20 }}>
          {/* Product Name */}
          <Text style={[styles.title, { color: colors.foreground }]}>{productName}</Text>

          {/* Price */}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <Text style={[styles.price, { color: colors.primary }]}>{formatAriary(product.price)}</Text>
            {product.regular_price && product.sale_price && (
              <Text style={[styles.oldPrice, { color: colors.muted }]}>{formatAriary(product.regular_price)}</Text>
            )}
          </View>

          {/* Stock status */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: product.stock_status === "instock" ? colors.success : colors.error }} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {product.stock_status === "instock" ? "En stock" : "Rupture de stock"}
            </Text>
          </View>

          {/* LamakoRewards Points Badge */}
          <PointsBadge price={product.price} compact={false} />

          {/* Categories */}
          {product.categories && product.categories.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {product.categories.map(cat => (
                <View key={cat.id} style={[styles.catChip, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.catChipText, { color: colors.primary }]}>{decodeHtmlEntities(cat.name)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Practical Info Table */}
          {practicalInfo && practicalInfo.length > 0 && (
            <View style={[styles.practicalInfoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Infos produit</Text>
              {practicalInfo.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.practicalInfoRow, idx < practicalInfo.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.practicalInfoLabel, { color: colors.muted }]}>{item.label}</Text>
                  <Text style={[styles.practicalInfoValue, { color: colors.foreground }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quantity */}
          <View style={[styles.qtyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.qtyLabel, { color: colors.foreground }]}>Quantité</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity onPress={() => setQty(q => Math.max(1, q - 1))} style={[styles.qtyBtn, { backgroundColor: colors.border }]}>
                <Text style={[styles.qtyBtnText, { color: colors.foreground }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.qtyValue, { color: colors.foreground }]}>{qty}</Text>
              <TouchableOpacity onPress={() => setQty(q => q + 1)} style={[styles.qtyBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          {desc ? (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Description</Text>
              <Text style={[styles.descText, { color: colors.muted }]}>{desc}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomSafePadding }]}>
        <TouchableOpacity
          onPress={() => {
            addItem({ productId: product.id, name: productName, price: parseFloat(product.price) || 0, image: allImages[0] || "", quantity: qty, isEvent: false });
            setCartToastName(productName);
            setShowCartToast(true);
            setTimeout(() => { router.push("/(tabs)/cart" as any); }, 1200);
          }}
          style={[styles.ctaButton, { backgroundColor: product.stock_status === "instock" ? colors.primary : colors.muted }]}
          disabled={product.stock_status !== "instock"}
        >
          <IconSymbol name="cart.fill" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>Ajouter au panier - {formatAriary(parseFloat(product.price) * qty)}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: { position: "absolute", top: 12, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  price: { fontSize: 26, fontWeight: "800" },
  oldPrice: { fontSize: 14, textDecorationLine: "line-through" },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catChipText: { fontSize: 12, fontWeight: "600" },
  practicalInfoBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  practicalInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  practicalInfoLabel: { fontSize: 13, flex: 1 },
  practicalInfoValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1 },
  qtyLabel: { fontSize: 15, fontWeight: "600" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qtyValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  descText: { fontSize: 14, lineHeight: 22 },
  productScroll: { flex: 1 },
  productScrollContent: { paddingBottom: 24 },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  ctaButton: { borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  ctaButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  galleryDots: { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

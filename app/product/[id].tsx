import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrFallback } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CatalogImage } from "@/components/catalog-image";
import { CartToast } from "@/components/cart-toast";
import { PointsBadge } from "@/components/points-badge";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getProduct, type WCProduct } from "@/lib/api/catalog";
import { MobileApiError } from "@/lib/api/mobile";
import { useCart } from "@/lib/cart-provider";
import { prefetchCatalogImages } from "@/lib/catalog-image-prefetch";
import { decodeHtmlEntities, formatAriary, stripHtml } from "@/lib/format";

function getProductErrorMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.status === 404) return "Ce produit n'est plus disponible.";
    if (error.status === 408)
      return "Le chargement prend trop de temps. Vérifiez votre connexion.";
    if (error.status >= 500)
      return "La boutique est momentanément indisponible.";
  }
  return "Impossible de charger ce produit. Vérifiez votre connexion.";
}

function getProductImageUrls(product: WCProduct): string[] {
  const mobileGallery = (product as any).lamako_mobile?.gallery;
  const urls = Array.isArray(mobileGallery)
    ? mobileGallery.filter(
        (url): url is string => typeof url === "string" && Boolean(url),
      )
    : [];

  for (const image of product.images || []) {
    if (image.src && !urls.includes(image.src)) urls.push(image.src);
  }
  return urls;
}

function getProductOptimizedImageUrl(
  product: WCProduct,
  originalUrl?: string,
): string | undefined {
  const image = product.images?.find((item) => item.src === originalUrl);
  return image?.variants?.webp || image?.variants?.avif || undefined;
}

function ProductDetailSkeleton({
  colors,
  width,
}: {
  colors: any;
  width: number;
}) {
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View
        style={[
          styles.skeletonHero,
          { width, backgroundColor: colors.surface },
        ]}
      />
      <View style={styles.skeletonContent}>
        <View
          style={[
            styles.skeletonLine,
            styles.skeletonTitle,
            { backgroundColor: colors.surface },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            styles.skeletonPrice,
            { backgroundColor: colors.surface },
          ]}
        />
        <View
          style={[
            styles.skeletonPanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            styles.skeletonBody,
            { backgroundColor: colors.surface },
          ]}
        />
      </View>
    </ScreenContainer>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<WCProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [qty, setQty] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showCartToast, setShowCartToast] = useState(false);
  const [cartToastName, setCartToastName] = useState("");
  const requestId = useRef(0);

  const loadProduct = useCallback(
    async (forceRefresh = false) => {
      const productId = Number(id);
      if (!Number.isFinite(productId) || productId <= 0) {
        setProduct(null);
        setErrorMessage("Ce produit n'est pas disponible.");
        setLoading(false);
        return;
      }

      const activeRequest = ++requestId.current;
      setLoading(true);
      setErrorMessage("");
      try {
        const nextProduct = await getProduct(productId, { forceRefresh });
        if (requestId.current !== activeRequest) return;
        void prefetchCatalogImages(getProductImageUrls(nextProduct));
        setGalleryIndex(0);
        setProduct(nextProduct);
      } catch (error) {
        if (requestId.current !== activeRequest) return;
        setProduct(null);
        setErrorMessage(getProductErrorMessage(error));
      } finally {
        if (requestId.current === activeRequest) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadProduct();
    return () => {
      requestId.current += 1;
    };
  }, [loadProduct]);

  if (loading) return <ProductDetailSkeleton colors={colors} width={width} />;
  if (!product)
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <View style={styles.errorState}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={34}
            color={colors.primary}
          />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Produit indisponible
          </Text>
          <Text style={[styles.errorMessage, { color: colors.muted }]}>
            {errorMessage || "Ce produit n'est plus disponible."}
          </Text>
          <TouchableOpacity
            onPress={() => void loadProduct(true)}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Réessayer le chargement du produit"
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goBackOrFallback(router, "/(tabs)/shop")}
            style={styles.secondaryButton}
            accessibilityRole="button"
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              Retour à la boutique
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );

  // Mobile fields from the lamako-mobile-fields plugin
  const mobileFields = (product as any).lamako_mobile as
    | {
        description: string | null;
        gallery: string[] | null;
        practical_info: { label: string; value: string }[] | null;
      }
    | undefined;
  const mobileDesc = mobileFields?.description;
  const practicalInfo = mobileFields?.practical_info;

  // Description: prefer mobile, fallback to site
  const siteDesc = stripHtml(
    product.short_description || product.description || "",
  );
  const desc = mobileDesc || siteDesc;

  // Images: mobile gallery + WC product images
  const allImages = getProductImageUrls(product);

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
        contentContainerStyle={[
          styles.productScrollContent,
          { paddingBottom: bottomSafePadding + 24 },
        ]}
      >
        {/* Image Gallery */}
        <View style={{ position: "relative" }}>
          {allImages.length > 1 ? (
            <View>
              <FlatList
                key={`product-gallery-${Math.round(width)}`}
                data={allImages}
                horizontal
                pagingEnabled
                initialScrollIndex={galleryIndex}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setGalleryIndex(idx);
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <CatalogImage
                    uri={item}
                    optimizedUri={getProductOptimizedImageUrl(product, item)}
                    style={{ width, aspectRatio: 1 / 0.85 }}
                    accessibilityLabel={`Photo de ${productName}`}
                    recyclingKey={`product-gallery-${product.id}-${item}`}
                  />
                )}
              />
              {/* Gallery dots */}
              <View style={styles.galleryDots}>
                {allImages.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i === galleryIndex ? "#fff" : "rgba(255,255,255,0.5)",
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <CatalogImage
              uri={allImages[0]}
              optimizedUri={getProductOptimizedImageUrl(product, allImages[0])}
              style={{ width, aspectRatio: 1 / 0.85 }}
              accessibilityLabel={`Photo de ${productName}`}
              recyclingKey={`product-featured-${product.id}`}
            />
          )}
          <TouchableOpacity
            onPress={() => goBackOrFallback(router, "/(tabs)/shop")}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20 }}>
          {/* Product Name */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {productName}
          </Text>

          {/* Price */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 10,
              marginTop: 8,
            }}
          >
            <Text style={[styles.price, { color: colors.primary }]}>
              {formatAriary(product.price)}
            </Text>
            {product.regular_price && product.sale_price && (
              <Text style={[styles.oldPrice, { color: colors.muted }]}>
                {formatAriary(product.regular_price)}
              </Text>
            )}
          </View>

          {/* Stock status */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor:
                  product.stock_status === "instock"
                    ? colors.success
                    : colors.error,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {product.stock_status === "instock"
                ? "En stock"
                : "Rupture de stock"}
            </Text>
          </View>

          {/* LamakoRewards Points Badge */}
          {product.lamakoRewardsEnabled !== false && (
            <PointsBadge price={product.price} compact={false} />
          )}

          {/* Categories */}
          {product.categories && product.categories.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 12,
              }}
            >
              {product.categories.map((cat) => (
                <View
                  key={cat.id}
                  style={[
                    styles.catChip,
                    { backgroundColor: colors.primary + "15" },
                  ]}
                >
                  <Text style={[styles.catChipText, { color: colors.primary }]}>
                    {decodeHtmlEntities(cat.name)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Practical Info Table */}
          {practicalInfo && practicalInfo.length > 0 && (
            <View
              style={[
                styles.practicalInfoBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Infos produit
              </Text>
              {practicalInfo.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.practicalInfoRow,
                    idx < practicalInfo.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.practicalInfoLabel, { color: colors.muted }]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.practicalInfoValue,
                      { color: colors.foreground },
                    ]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Quantity */}
          <View
            style={[
              styles.qtyRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.qtyLabel, { color: colors.foreground }]}>
              Quantité
            </Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                onPress={() => setQty((q) => Math.max(1, q - 1))}
                style={[styles.qtyBtn, { backgroundColor: colors.border }]}
              >
                <Text style={[styles.qtyBtnText, { color: colors.foreground }]}>
                  -
                </Text>
              </TouchableOpacity>
              <Text style={[styles.qtyValue, { color: colors.foreground }]}>
                {qty}
              </Text>
              <TouchableOpacity
                onPress={() => setQty((q) => q + 1)}
                style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          {desc ? (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Description
              </Text>
              <Text style={[styles.descText, { color: colors.muted }]}>
                {desc}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          styles.bottomCta,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: bottomSafePadding,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            addItem({
              productId: product.id,
              name: productName,
              price: parseFloat(product.price) || 0,
              image: allImages[0] || "",
              quantity: qty,
              isEvent: false,
              lamakoRewardsEnabled: product.lamakoRewardsEnabled !== false,
            });
            setCartToastName(productName);
            setShowCartToast(true);
            setTimeout(() => {
              router.push("/(tabs)/cart" as any);
            }, 1200);
          }}
          style={[
            styles.ctaButton,
            {
              backgroundColor:
                product.stock_status === "instock"
                  ? colors.primary
                  : colors.muted,
            },
          ]}
          disabled={product.stock_status !== "instock"}
        >
          <IconSymbol name="cart.fill" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>
            Ajouter au panier - {formatAriary(parseFloat(product.price) * qty)}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  skeletonHero: { aspectRatio: 1 / 0.85 },
  skeletonContent: { padding: 20, gap: 16 },
  skeletonLine: { height: 18, borderRadius: 6 },
  skeletonTitle: { width: "78%", height: 28 },
  skeletonPrice: { width: "38%", height: 24 },
  skeletonBody: { width: "92%", height: 80 },
  skeletonPanel: {
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  errorState: { alignItems: "center", width: "100%", maxWidth: 420 },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    width: "100%",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "600" },
  backButton: {
    position: "absolute",
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  price: { fontSize: 26, fontWeight: "800" },
  oldPrice: { fontSize: 14, textDecorationLine: "line-through" },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catChipText: { fontSize: 12, fontWeight: "600" },
  practicalInfoBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  practicalInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  practicalInfoLabel: { fontSize: 13, flex: 1 },
  practicalInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  qtyLabel: { fontSize: 15, fontWeight: "600" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qtyValue: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  descText: { fontSize: 14, lineHeight: 22 },
  productScroll: { flex: 1 },
  productScrollContent: { paddingBottom: 24 },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  ctaButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  galleryDots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

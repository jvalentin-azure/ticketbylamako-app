import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getProduct, getEventMeta, type WCProduct } from "@/lib/api/woocommerce";
import { formatAriary, formatDate, stripHtml } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { addItem } = useCart();
  const [event, setEvent] = useState<WCProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    getProduct(Number(id)).then(e => { setEvent(e); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!event) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted }}>Événement introuvable</Text>
      </ScreenContainer>
    );
  }

  const date = getEventMeta(event, "event_date_time");
  const location = getEventMeta(event, "event_location");
  const desc = stripHtml(event.description || event.short_description || "");
  const variations = event.variations || [];
  const hasVariations = variations.length > 0;

  const handleAddToCart = () => {
    addItem({
      productId: event.id,
      name: event.name,
      price: parseFloat(event.price) || 0,
      image: event.images?.[0]?.src || "",
      quantity: qty,
      isEvent: true,
    });
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={{ position: "relative" }}>
          <Image source={{ uri: event.images?.[0]?.src }} style={{ width: SCREEN_W, height: 280 }} contentFit="cover" />
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: "absolute", top: 12, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20 }}>
          {/* Title */}
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>{event.name}</Text>

          {/* Info Row */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
            {date && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                  <IconSymbol name="calendar" size={18} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Date</Text>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{formatDate(date)}</Text>
                </View>
              </View>
            )}
            {location && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
                  <IconSymbol name="mappin" size={18} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Lieu</Text>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{location}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Price */}
          <View style={{ marginTop: 20, padding: 16, borderRadius: 14, backgroundColor: colors.primary + "10", borderWidth: 1, borderColor: colors.primary + "30" }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>À partir de</Text>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800", marginTop: 2 }}>{formatAriary(event.price)}</Text>
          </View>

          {/* Ticket Types (variations) */}
          {hasVariations && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 10 }}>Types de billets</Text>
              {event.attributes?.map((attr: any) => (
                <View key={attr.name}>
                  {attr.options?.map((opt: string) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setSelectedVariation(null)}
                      style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                      </View>
                      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 }}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Quantity */}
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

          {/* Description */}
          {desc ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Description</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{desc}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={{ padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={handleAddToCart}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
        >
          <IconSymbol name="cart.fill" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Ajouter au panier - {formatAriary(Number(event.price) * qty)}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

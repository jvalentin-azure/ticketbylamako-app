import { Text, View, TouchableOpacity, FlatList, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatAriary } from "@/lib/format";

export default function CartScreen() {
  const colors = useColors();
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, total, itemCount } = useCart();

  const handleCheckout = () => {
    if (items.length === 0) return;
    router.push("/checkout" as any);
  };

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Panier</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <IconSymbol name="cart.fill" size={64} color={colors.muted} />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "600", marginTop: 16 }}>Votre panier est vide</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>Parcourez nos événements et notre boutique pour ajouter des articles</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/" as any)}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 20 }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Découvrir</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700" }}>Panier ({itemCount})</Text>
        <TouchableOpacity onPress={() => Alert.alert("Vider le panier", "Supprimer tous les articles ?", [{ text: "Annuler" }, { text: "Vider", style: "destructive", onPress: clearCart }])}>
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Tout supprimer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.productId}-${item.seatLabel || i}`}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 12 }}>
            <Image source={{ uri: item.image }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
            <View style={{ flex: 1, marginLeft: 12, justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>{item.name}</Text>
                {item.isEvent && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                    <IconSymbol name="ticket.fill" size={12} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 11, marginLeft: 4 }}>Billet{item.seatLabel ? ` - ${item.seatLabel}` : ""}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>{formatAriary(item.price)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => item.quantity <= 1 ? removeItem(item.productId, item.seatLabel) : updateQuantity(item.productId, item.quantity - 1, item.seatLabel)}
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{item.quantity <= 1 ? "×" : "-"}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", minWidth: 16, textAlign: "center" }}>{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.productId, item.quantity + 1, item.seatLabel)}
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.muted, fontSize: 15 }}>Sous-total</Text>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{formatAriary(total)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Total</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "800" }}>{formatAriary(total)}</Text>
            </View>
          </View>
        }
      />

      <View style={{ padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handleCheckout}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
        >
          <IconSymbol name="lock.fill" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Passer la commande</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

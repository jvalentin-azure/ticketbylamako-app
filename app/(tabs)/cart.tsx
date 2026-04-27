import { Text, View, TouchableOpacity, FlatList, Alert, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatAriary, decodeHtmlEntities } from "@/lib/format";

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
      <ScreenContainer edges={["left", "right"]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Panier</Text>
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol name="cart.fill" size={64} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Votre panier est vide</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>Parcourez nos événements et notre boutique pour ajouter des articles</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/" as any)}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.emptyBtnText}>Découvrir</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRowFull}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Panier ({itemCount})</Text>
        <TouchableOpacity onPress={() => Alert.alert("Vider le panier", "Supprimer tous les articles ?", [{ text: "Annuler" }, { text: "Vider", style: "destructive", onPress: clearCart }])}>
          <Text style={[styles.clearText, { color: colors.error }]}>Tout supprimer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.productId}-${item.seatLabel || i}`}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.cartItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Image source={{ uri: item.image }} style={styles.cartItemImage} contentFit="cover" />
            <View style={styles.cartItemBody}>
              <View>
                <Text style={[styles.cartItemName, { color: colors.foreground }]} numberOfLines={2}>{decodeHtmlEntities(item.name)}</Text>
                {item.isEvent && (
                  <View style={styles.ticketBadge}>
                    <IconSymbol name="ticket.fill" size={12} color={colors.primary} />
                    <Text style={[styles.ticketBadgeText, { color: colors.primary }]}>Billet{item.seatLabel ? ` - ${item.seatLabel}` : ""}</Text>
                  </View>
                )}
              </View>
              <View style={styles.cartItemFooter}>
                <Text style={[styles.cartItemPrice, { color: colors.primary }]}>{formatAriary(item.price)}</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    onPress={() => item.quantity <= 1 ? removeItem(item.productId, item.seatLabel) : updateQuantity(item.productId, item.quantity - 1, item.seatLabel)}
                    style={[styles.qtyBtn, { backgroundColor: colors.border }]}
                  >
                    <Text style={[styles.qtyBtnText, { color: colors.foreground }]}>{item.quantity <= 1 ? "×" : "-"}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, { color: colors.foreground }]}>{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.productId, item.quantity + 1, item.seatLabel)}
                    style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.qtyBtnText, { color: "#fff" }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 8 }}>
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.muted }]}>Sous-total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatAriary(total)}</Text>
            </View>
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatAriary(total)}</Text>
            </View>
          </View>
        }
      />

      <View style={[styles.bottomCta, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleCheckout}
          style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
        >
          <IconSymbol name="lock.fill" size={18} color="#fff" />
          <Text style={styles.checkoutBtnText}>Passer la commande</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRowFull: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", fontFamily: "Raleway-Bold" },
  clearText: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, fontFamily: "Raleway-SemiBold" },
  emptySub: { fontSize: 14, textAlign: "center", marginTop: 8, fontFamily: "Raleway-Regular" },
  emptyBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 20 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Raleway-Bold" },
  cartItem: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  cartItemImage: { width: 72, height: 72, borderRadius: 10 },
  cartItemBody: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  cartItemName: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  ticketBadge: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  ticketBadgeText: { fontSize: 11, marginLeft: 4, fontFamily: "Raleway-Medium" },
  cartItemFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cartItemPrice: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 16, fontWeight: "700" },
  qtyValue: { fontSize: 14, fontWeight: "700", minWidth: 16, textAlign: "center", fontFamily: "Raleway-Bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1 },
  totalLabel: { fontSize: 15, fontFamily: "Raleway-Regular" },
  totalValue: { fontSize: 15, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  grandTotalLabel: { fontSize: 18, fontWeight: "700", fontFamily: "Raleway-Bold" },
  grandTotalValue: { fontSize: 20, fontWeight: "800", fontFamily: "Raleway-Bold" },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  checkoutBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
});

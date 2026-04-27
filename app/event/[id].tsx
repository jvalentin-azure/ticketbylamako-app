import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getTCEvent, getEventTickets, type TCEvent, type TicketType } from "@/lib/api/woocommerce";
import { formatAriary, formatDate, stripHtml, decodeHtmlEntities } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const { addItem } = useCart();
  const [event, setEvent] = useState<TCEvent | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getTCEvent(Number(id)),
      getEventTickets(Number(id)),
    ]).then(([ev, tix]) => {
      setEvent(ev);
      setTickets(tix);
      if (tix.length === 1) setSelectedTicket(tix[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
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
        <Text style={{ color: colors.muted, fontFamily: "Raleway-Medium" }}>Événement introuvable</Text>
      </ScreenContainer>
    );
  }

  const name = decodeHtmlEntities(event.title.rendered);
  const desc = stripHtml(event.content?.rendered || "");
  const cats = event.categoryNames?.join(", ") || "";
  const hasSeating = tickets.some(t => t.usesSeating);

  const handleAddToCart = () => {
    if (!selectedTicket) return;
    addItem({
      productId: selectedTicket.id,
      name: `${name} - ${selectedTicket.name}`,
      price: parseFloat(selectedTicket.price) || 0,
      image: event.featuredImage || "",
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
          <Image source={{ uri: event.featuredImage }} style={{ width: SCREEN_W, height: 280 }} contentFit="cover" />
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
          {hasSeating && (
            <View style={styles.seatingOverlayBadge}>
              <IconSymbol name="mappin" size={12} color="#fff" />
              <Text style={styles.seatingOverlayText}>Plan de salle disponible</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 20 }}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>{name}</Text>

          {/* Categories */}
          {cats ? (
            <View style={styles.catsRow}>
              <IconSymbol name="tag.fill" size={14} color={colors.primary} />
              <Text style={[styles.catsText, { color: colors.primary }]}>{cats}</Text>
            </View>
          ) : null}

          {/* Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
                <IconSymbol name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Date</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDate(event.date)}</Text>
              </View>
            </View>
          </View>

          {/* Price Range */}
          {tickets.length > 0 && (
            <View style={[styles.priceBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Text style={[styles.priceLabel, { color: colors.primary }]}>
                {tickets.length === 1 ? "Prix" : "À partir de"}
              </Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                {tickets.length === 1
                  ? formatAriary(tickets[0].price)
                  : formatAriary(Math.min(...tickets.map(t => parseFloat(t.price) || 0)))}
              </Text>
            </View>
          )}

          {/* Ticket Types */}
          {tickets.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Types de billets</Text>
              {tickets.map(ticket => {
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => { setSelectedTicket(ticket); setQty(1); }}
                    style={[styles.ticketOption, {
                      backgroundColor: isSelected ? colors.primary + "10" : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                  >
                    <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.muted }]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.ticketName, { color: colors.foreground }]}>{decodeHtmlEntities(ticket.name)}</Text>
                      {ticket.usesSeating && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                          <IconSymbol name="mappin" size={10} color="#c79f6c" />
                          <Text style={{ color: "#c79f6c", fontSize: 11, marginLeft: 4, fontFamily: "Raleway-Medium" }}>Siège assigné</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.ticketPrice, { color: colors.primary }]}>{formatAriary(ticket.price)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Quantity */}
          {selectedTicket && !selectedTicket.usesSeating && (
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
          )}

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
      <View style={[styles.bottomCta, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={!selectedTicket}
          style={[styles.ctaButton, { backgroundColor: selectedTicket ? colors.primary : colors.muted, opacity: selectedTicket ? 1 : 0.5 }]}
        >
          <IconSymbol name="cart.fill" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>
            {selectedTicket
              ? `Ajouter au panier - ${formatAriary(Number(selectedTicket.price) * qty)}`
              : "Sélectionnez un billet"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: { position: "absolute", top: 12, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  seatingOverlayBadge: { position: "absolute", bottom: 12, right: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  seatingOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  title: { fontSize: 24, fontWeight: "700", fontFamily: "Raleway-Bold" },
  catsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  catsText: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 },
  infoItem: { flexDirection: "row", alignItems: "center" },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontFamily: "Raleway-Regular" },
  infoValue: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  priceBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  priceLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  priceValue: { fontSize: 28, fontWeight: "800", marginTop: 2, fontFamily: "Raleway-Bold" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, fontFamily: "Raleway-Bold" },
  ticketOption: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  ticketName: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  ticketPrice: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1 },
  qtyLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qtyValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center", fontFamily: "Raleway-Bold" },
  descText: { fontSize: 14, lineHeight: 22, fontFamily: "Raleway-Regular" },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  ctaButton: { borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  ctaButtonText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
});

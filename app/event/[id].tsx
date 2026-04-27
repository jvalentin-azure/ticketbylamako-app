import { useEffect, useState, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, FlatList, Platform, Linking, Share } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getTCEvent, getEventTickets, getSeatingChartUrl, type TCEvent, type TicketType } from "@/lib/api/woocommerce";
import { useFavorites } from "@/lib/favorites-provider";
import { formatAriary, formatDate, stripHtml, decodeHtmlEntities } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");
const SITE_URL = process.env.EXPO_PUBLIC_WC_SITE_URL || "https://www.ticketbylamako.com";

// Conditionally require WebView for native platforms
let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComponent = require("react-native-webview").default;
  } catch {}
}

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
  const [showSeatingChart, setShowSeatingChart] = useState(false);
  const [seatingChartUrl, setSeatingChartUrl] = useState<string | null>(null);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const { isFavorite, toggleFavorite } = useFavorites();

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
  const mobileDesc = event.mobileFields?.description;
  const siteDesc = stripHtml(event.content?.rendered || "");
  const desc = mobileDesc || siteDesc;
  const gallery = event.mobileFields?.gallery;
  const practicalInfo = event.mobileFields?.practical_info;
  const cats = event.categoryNames?.join(", ") || "";
  const hasSeating = tickets.some(t => t.usesSeating);

  // Build image list: featured image + gallery
  const allImages: string[] = [];
  if (event.featuredImage) allImages.push(event.featuredImage);
  if (gallery && gallery.length > 0) {
    gallery.forEach(img => { if (img && !allImages.includes(img)) allImages.push(img); });
  }

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

  const handleOpenSeatingChart = async () => {
    if (!selectedTicket?.usesSeating || !event) return;
    setSeatingLoading(true);
    try {
      const url = await getSeatingChartUrl(Number(id), event.slug, event.link);
      if (url) {
        setSeatingChartUrl(url);
        setShowSeatingChart(true);
      } else {
        // Fallback: open event page directly in browser
        const fallbackUrl = event.link || `${SITE_URL}/tc-events/${event.slug}/`;
        Linking.openURL(fallbackUrl);
      }
    } catch {
      const fallbackUrl = event.link || `${SITE_URL}/tc-events/${event.slug}/`;
      Linking.openURL(fallbackUrl);
    } finally {
      setSeatingLoading(false);
    }
  };

  // Seating Chart WebView - loads the tc_seat_charts page directly (same approach as POS plugin)
  if (showSeatingChart && event && seatingChartUrl) {
    // The embed URL (lamako_seat_embed=1) renders a clean page with only the seating chart.
    // This injected JS is a safety net: hides any remaining theme elements and ensures
    // the seating chart button is visible and styled correctly.
    const injectedJS = `
      (function() {
        function cleanup() {
          var style = document.createElement('style');
          style.textContent = 
            'header, .site-header, #masthead, .header-wrapper, .header-main, .header-top, .header-bottom,' +
            'footer, .site-footer, #colophon, .footer-wrapper, .absolute-footer,' +
            'nav:not(.tc-nav), .breadcrumbs, .woocommerce-breadcrumb, #wpadminbar,' +
            '.sidebar, #sidebar, aside,' +
            '[class*="whatsapp"], .joinchat, [id*="whatsapp"],' +
            '[class*="cookie"], [class*="consent"],' +
            '#fkcart-floating-toggler, .fkcart-main-wrapper,' +
            '[class*="tidio"], [id*="tidio"], [class*="chat-widget"],' +
            '[class*="crisp"], [id*="crisp"],' +
            '[class*="tawk"], [id*="tawk"]' +
            '{ display: none !important; }' +
            /* Auto-click the Pick your seat(s) button after page load */
            '.tc_seating_map_button {' +
            '  display: block !important; margin: 20px auto !important; padding: 16px 40px !important;' +
            '  font-size: 17px !important; font-weight: 700 !important;' +
            '  background: #663d17 !important; color: #fff !important;' +
            '  border: none !important; border-radius: 14px !important;' +
            '  cursor: pointer !important; text-align: center !important;' +
            '  width: 90% !important; max-width: 400px !important;' +
            '}' +
            /* Make the seating map overlay scrollable on mobile */
            '.tc_seating_map {' +
            '  overflow: auto !important;' +
            '  -webkit-overflow-scrolling: touch !important;' +
            '}' +
            '.tc-wrapper {' +
            '  min-width: 1920px !important;' +
            '  min-height: 1400px !important;' +
            '  overflow: visible !important;' +
            '}' +
            /* Keep subtotal bar fixed at top */
            '.tc-seatchart-subtotal {' +
            '  position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;' +
            '  z-index: 1000002 !important; background: rgba(255,255,255,0.97) !important;' +
            '  padding: 10px 16px !important; font-weight: 600 !important; text-align: center !important;' +
            '  box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important; font-size: 16px !important;' +
            '}' +
            /* Keep GO TO CART fixed at bottom */
            '.tc-seatchart-go-to-cart, a.tc-seatchart-go-to-cart {' +
            '  position: fixed !important; bottom: 20px !important; left: 50% !important;' +
            '  transform: translateX(-50%) !important; z-index: 1000002 !important;' +
            '  background: #663d17 !important; color: #fff !important;' +
            '  padding: 14px 40px !important; border-radius: 14px !important;' +
            '  font-weight: 700 !important; font-size: 16px !important;' +
            '  text-decoration: none !important; box-shadow: 0 4px 14px rgba(102,61,23,0.4) !important;' +
            '  white-space: nowrap !important;' +
            '}' +
            /* Keep legend accessible */
            '.tc-seating-legend-wrap {' +
            '  position: fixed !important; top: 50px !important; left: 10px !important;' +
            '  z-index: 1000001 !important; background: rgba(255,255,255,0.95) !important;' +
            '  border-radius: 8px !important; padding: 8px !important;' +
            '  box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important; max-width: 200px !important;' +
            '  font-size: 12px !important;' +
            '}';
          document.head.appendChild(style);
          // Auto-click the "Pick your seat(s)" button after a short delay
          setTimeout(function() {
            var btn = document.querySelector('.tc_seating_map_button');
            if (btn) btn.click();
          }, 1500);
        }
        if (document.readyState === 'complete') setTimeout(cleanup, 500);
        else window.addEventListener('load', function() { setTimeout(cleanup, 500); });
      })();
      true;
    `;
    
    if (Platform.OS === "web") {
      return (
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={[styles.seatingHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowSeatingChart(false)} style={styles.seatingBackBtn}>
              <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
              <Text style={[styles.seatingBackText, { color: colors.foreground }]}>Retour</Text>
            </TouchableOpacity>
            <Text style={[styles.seatingTitle, { color: colors.foreground }]}>Plan de salle</Text>
            <View style={{ width: 80 }} />
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Text style={{ color: colors.muted, fontFamily: "Raleway-Medium", textAlign: "center" }}>
              Le plan de salle interactif n'est pas disponible sur le web.{"\n"}Ouvrez l'app sur votre téléphone pour sélectionner votre siège.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(seatingChartUrl!)}
              style={[styles.webFallbackBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.webFallbackBtnText}>Ouvrir sur le site</Text>
            </TouchableOpacity>
          </View>
        </ScreenContainer>
      );
    }

    if (!WebViewComponent) {
      return (
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.muted }}>WebView non disponible</Text>
          </View>
        </ScreenContainer>
      );
    }

    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.seatingHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowSeatingChart(false)} style={styles.seatingBackBtn}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
            <Text style={[styles.seatingBackText, { color: colors.foreground }]}>Retour</Text>
          </TouchableOpacity>
          <Text style={[styles.seatingTitle, { color: colors.foreground }]}>Plan de salle</Text>
          <View style={{ width: 80 }} />
        </View>
        <WebViewComponent
          source={{ uri: seatingChartUrl! }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mixedContentMode="compatibility"
          scalesPageToFit={true}
          allowsBackForwardNavigationGestures={false}
          bounces={false}
          scrollEnabled={true}
          injectedJavaScript={injectedJS}
          renderLoading={() => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 12, color: colors.muted, fontFamily: "Raleway-Medium", textAlign: "center" }}>{"Chargement du plan de salle...\nAppuyez sur le bouton pour choisir votre siège"}</Text>
            </View>
          )}
          onNavigationStateChange={(navState: any) => {
            const url = navState.url || "";
            // If user completes checkout, go to tickets
            if (url.includes("order-received") || url.includes("commande-recue")) {
              setShowSeatingChart(false);
              router.replace("/(tabs)/tickets");
            }
            // If user goes to cart/checkout, let them continue in WebView
          }}
          onShouldStartLoadWithRequest={(request: any) => {
            // Allow all navigation within the site
            const url = request.url || "";
            if (url.startsWith(SITE_URL) || url.startsWith("about:") || url.startsWith("data:")) return true;
            // Block external navigation
            return false;
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image / Gallery */}
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
                  <Image source={{ uri: item }} style={{ width: SCREEN_W, height: 280 }} contentFit="cover" />
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
            <Image source={{ uri: event.featuredImage }} style={{ width: SCREEN_W, height: 280 }} contentFit="cover" />
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Share & Favorite buttons */}
          <View style={styles.topRightActions}>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await Share.share({
                    title: name,
                    message: `${name} - Découvrez cet événement sur TicketByLamako !\n${event.link || `https://www.ticketbylamako.com/tc-events/${event.slug}/`}`,
                    url: event.link || `https://www.ticketbylamako.com/tc-events/${event.slug}/`,
                  });
                } catch {}
              }}
              style={styles.topActionBtn}
            >
              <IconSymbol name="square.and.arrow.up" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleFavorite({ id: event.id, type: "event", name, image: event.featuredImage })}
              style={styles.topActionBtn}
            >
              <IconSymbol name={isFavorite(event.id, "event") ? "heart.fill" : "heart"} size={18} color={isFavorite(event.id, "event") ? "#EF4444" : "#fff"} />
            </TouchableOpacity>
          </View>
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

          {/* Practical Info Table */}
          {practicalInfo && practicalInfo.length > 0 && (
            <View style={[styles.practicalInfoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Infos pratiques</Text>
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

          {/* Seating Chart Button */}
          {selectedTicket?.usesSeating && (
            <TouchableOpacity
              onPress={handleOpenSeatingChart}
              disabled={seatingLoading}
              style={[styles.seatingChartBtn, { backgroundColor: "#663d17", opacity: seatingLoading ? 0.7 : 1 }]}
            >
              {seatingLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <IconSymbol name="mappin" size={18} color="#fff" />
              )}
              <Text style={styles.seatingChartBtnText}>{seatingLoading ? "Chargement..." : "Voir le plan de salle & choisir mon siège"}</Text>
            </TouchableOpacity>
          )}

          {/* Quantity (for non-seating tickets) */}
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
        {selectedTicket?.usesSeating ? (
          <TouchableOpacity
            onPress={handleOpenSeatingChart}
            disabled={seatingLoading}
            style={[styles.ctaButton, { backgroundColor: "#663d17", opacity: seatingLoading ? 0.7 : 1 }]}
          >
            {seatingLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconSymbol name="mappin" size={20} color="#fff" />
            )}
            <Text style={styles.ctaButtonText}>{seatingLoading ? "Chargement du plan..." : "Choisir mon siège"}</Text>
          </TouchableOpacity>
        ) : (
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
        )}
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
  practicalInfoBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  practicalInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  practicalInfoLabel: { fontSize: 13, fontFamily: "Raleway-Medium", flex: 1 },
  practicalInfoValue: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold", flex: 1, textAlign: "right" },
  priceBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  priceLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  priceValue: { fontSize: 28, fontWeight: "800", marginTop: 2, fontFamily: "Raleway-Bold" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, fontFamily: "Raleway-Bold" },
  ticketOption: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  ticketName: { fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  ticketPrice: { fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  seatingChartBtn: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 12 },
  seatingChartBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Raleway-Bold" },
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
  galleryDots: { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  seatingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  seatingBackBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  seatingBackText: { fontSize: 15, fontFamily: "Raleway-Medium" },
  seatingTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  webFallbackBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  webFallbackBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  topRightActions: { position: "absolute", top: 12, right: 16, flexDirection: "row", gap: 8 },
  topActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
});

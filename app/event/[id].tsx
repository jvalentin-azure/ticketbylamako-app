import { useEffect, useState, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, FlatList, Platform, Linking, Share, Alert } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getTCEvent, getEventTickets, getSeatingChartUrl, getEventsWithTickets, clearServerCart, type TCEvent, type TicketType } from "@/lib/api/woocommerce";
import { useFavorites } from "@/lib/favorites-provider";
import { formatAriary, formatDate, formatDateShort, stripHtml, decodeHtmlEntities } from "@/lib/format";
import { LinearGradient } from "expo-linear-gradient";

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
  const { addItem, clearCart } = useCart();
  const [event, setEvent] = useState<TCEvent | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [qty, setQty] = useState(1);
  const [showSeatingChart, setShowSeatingChart] = useState(false);
  const [seatingChartUrl, setSeatingChartUrl] = useState<string | null>(null);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [webviewPhase, setWebviewPhase] = useState<'seating' | 'checkout' | 'confirmation'>('seating');
  const webviewRef = useRef<any>(null);
  const [seatingReady, setSeatingReady] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [upcomingEvents, setUpcomingEvents] = useState<TCEvent[]>([]);
  const [countdown, setCountdown] = useState<{days: number; hours: number; mins: number; secs: number} | null>(null);
  const [showFullTerms, setShowFullTerms] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getTCEvent(Number(id)),
      getEventTickets(Number(id)),
      getEventsWithTickets(),
    ]).then(([ev, tix, allEvents]) => {
      setEvent(ev);
      setTickets(tix);
      if (tix.length === 1) setSelectedTicket(tix[0]);
      // Filter upcoming events (exclude current)
      const now = Date.now();
      const upcoming = allEvents.filter(e => {
        if (e.id === Number(id)) return false;
        const dt = e.mobileFields?.event_date_time;
        if (!dt) return true;
        return new Date(dt.replace(' ', 'T')).getTime() > now;
      }).slice(0, 8);
      setUpcomingEvents(upcoming);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Countdown timer (updates every second)
  useEffect(() => {
    if (!event) return;
    const dateStr = event.mobileFields?.event_date_time;
    if (!dateStr) return;
    const eventTime = new Date(dateStr.replace(' ', 'T')).getTime();
    if (eventTime <= Date.now()) { setCountdown(null); return; }
    const update = () => {
      const diff = eventTime - Date.now();
      if (diff <= 0) { setCountdown(null); return; }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [event]);

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
    if (!hasSeating || !event) return;
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
    // JS injected on every page load in the WebView - hides site chrome
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
            '[class*="tawk"], [id*="tawk"],' +
            '.tc-seatchart-go-to-cart, a.tc-seatchart-go-to-cart,' +
            '.tc-checkout-bar' +
            '{ display: none !important; }' +
            '.tc_in_cart { position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 998 !important; background: rgba(255,255,255,0.97) !important; border-top: 1px solid #e5e7eb !important; padding: 8px 16px !important; font-size: 13px !important; max-height: 100px !important; overflow-y: auto !important; }' +
            '.tc-seatchart-subtotal { font-weight: 600 !important; color: #663d17 !important; }' +
            /* HIDE jQuery UI dialog entirely - we bypass it with direct AJAX in embed */
            '.ui-widget-overlay, .ui-dialog, .tc-seat-dialog { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';
          document.head.appendChild(style);
          // Auto-click the "Pick your seat(s)" button after a short delay (only on seating page)
          if (window.location.href.indexOf('lamako_seat_embed') > -1) {
            setTimeout(function() {
              var btn = document.querySelector('.tc_seating_map_button');
              if (btn) btn.click();
            }, 2000);
          }
          // On checkout page, add mobile-friendly styles
          if (window.location.href.indexOf('/checkout') > -1 || window.location.href.indexOf('/commande') > -1) {
            var checkoutStyle = document.createElement('style');
            checkoutStyle.textContent = 
              'body { font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; font-size: 15px !important; }' +
              '.woocommerce-checkout { padding: 12px !important; }' +
              '.woocommerce-form-coupon-toggle, .woocommerce-form-login-toggle { display: none !important; }' +
              'table.shop_table { font-size: 14px !important; }' +
              '#payment { margin-top: 16px !important; }' +
              '#place_order { font-size: 17px !important; padding: 14px !important; border-radius: 12px !important; }';
            document.head.appendChild(checkoutStyle);
            // Notify app that checkout page loaded
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'checkout_loaded' }));
            }
          }
          // On order confirmation page
          if (window.location.href.indexOf('order-received') > -1 || window.location.href.indexOf('commande-recue') > -1) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'order_confirmed' }));
            }
          }
        }
        if (document.readyState === 'complete') setTimeout(cleanup, 500);
        else window.addEventListener('load', function() { setTimeout(cleanup, 500); });
      })();
      true;
    `;

    // Header title and icon based on current phase
    const headerTitle = webviewPhase === 'seating' ? 'Plan de salle' 
      : webviewPhase === 'checkout' ? 'Paiement sécurisé' 
      : 'Confirmation';
    const headerIcon = webviewPhase === 'checkout' ? 'lock.fill' : webviewPhase === 'confirmation' ? 'checkmark.circle.fill' : undefined;
    
    if (Platform.OS === "web") {
      return (
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={[styles.seatingHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { clearServerCart(); setShowSeatingChart(false); }} style={styles.seatingBackBtn}>
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
          <TouchableOpacity onPress={() => {
            if (webviewPhase === 'confirmation') {
              // After order confirmation, go to tickets
              setShowSeatingChart(false);
              setWebviewPhase('seating');
              router.replace("/(tabs)/tickets");
            } else if (webviewPhase === 'checkout') {
              // User is leaving during checkout - clear cart AND server-side seats
              clearCart();
              clearServerCart(); // Release Tickera seat transients on server
              setShowSeatingChart(false);
              setWebviewPhase('seating');
            } else {
              // User is leaving seating chart - clear local cart AND server-side seat reservations
              clearCart();
              clearServerCart(); // Release Tickera seat transients on server
              setShowSeatingChart(false);
              setWebviewPhase('seating');
            }
          }} style={styles.seatingBackBtn}>
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
            <Text style={[styles.seatingBackText, { color: colors.foreground }]}>
              {webviewPhase === 'confirmation' ? 'Mes billets' : 'Retour'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {headerIcon && <IconSymbol name={headerIcon as any} size={16} color={webviewPhase === 'checkout' ? colors.success : colors.primary} />}
            <Text style={[styles.seatingTitle, { color: colors.foreground }]}>{headerTitle}</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>
        <WebViewComponent
          ref={webviewRef}
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
              <Text style={{ marginTop: 12, color: colors.muted, fontFamily: "Raleway-Medium", textAlign: "center" }}>
                {webviewPhase === 'checkout' ? "Chargement du paiement..." : "Chargement du plan de salle..."}
              </Text>
            </View>
          )}
          onMessage={(e: any) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data.type === 'seats_confirmed' && data.seats && Array.isArray(data.seats)) {
                // Add each seat to the local cart
                data.seats.forEach((seat: any) => {
                  if (seat.ticketTypeId && seat.price) {
                    addItem({
                      productId: Number(seat.ticketTypeId),
                      name: `${event?.title?.rendered || 'Événement'} - ${seat.ticketTypeName || 'Siège'} (${seat.label || 'Siège'})`,
                      price: Number(seat.price) || 0,
                      image: event?.featuredImage || "",
                      isEvent: true,
                      seatLabel: seat.label || seat.seatId || '',
                    });
                  }
                });
                // Close the seating chart WebView and go to cart
                setShowSeatingChart(false);
                setWebviewPhase('seating');
                setSeatingReady(false);
                // Navigate to cart so user can see their seats and proceed to checkout
                setTimeout(() => router.push('/(tabs)/cart'), 300);
              }
              if (data.type === 'no_seats_selected') {
                if (Platform.OS !== 'web') {
                  const debugInfo = data.debug ? `\n\nDébug: ${data.debug.totalSeats} sièges trouvés, ${data.debug.cartItems} dans le panier` : '';
                  Alert.alert(
                    'Aucun siège sélectionné',
                    'Veuillez sélectionner au moins un siège en appuyant dessus sur le plan, puis appuyez sur "Confirmer ma sélection".' + debugInfo
                  );
                }
              }
              if (data.type === 'seat_extraction_error') {
                if (Platform.OS !== 'web') {
                  Alert.alert('Erreur', 'Impossible d\'extraire les sièges sélectionnés. Veuillez réessayer.');
                }
              }
              if (data.type === 'seat_count_update') {
                setSelectedSeats(data.seats || []);
              }
              if (data.type === 'navigating_to_checkout' || data.type === 'checkout_loaded') {
                setWebviewPhase('checkout');
              }
              if (data.type === 'order_confirmed') {
                setWebviewPhase('confirmation');
                clearCart();
              }
            } catch {}
          }}
          onNavigationStateChange={(navState: any) => {
            const url = navState.url || "";
            // Detect checkout page
            if (url.includes('/checkout') || url.includes('/commande')) {
              setWebviewPhase('checkout');
            }
            // Detect order confirmation page
            if (url.includes("order-received") || url.includes("commande-recue")) {
              setWebviewPhase('confirmation');
            }
          }}
          onShouldStartLoadWithRequest={(request: any) => {
            // Allow all navigation within the site (including checkout)
            const url = request.url || "";
            if (url.startsWith(SITE_URL) || url.startsWith("about:") || url.startsWith("data:")) return true;
            // Allow payment gateway redirects (some payment gateways redirect to external URLs)
            if (url.includes('mvola') || url.includes('orange') || url.includes('airtel') || url.includes('cybersource') || url.includes('visa')) return true;
            // Block other external navigation
            return false;
          }}
        />
        {/* Native confirm button overlay - always visible during seating phase */}
        {webviewPhase === 'seating' && (
          <View style={[styles.confirmOverlay, { bottom: 0 }]}>
            {/* Selected seats display */}
            {selectedSeats.length > 0 && (
              <View style={{ width: '100%', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, fontFamily: 'Raleway-Bold' }}>
                  {selectedSeats.length} {selectedSeats.length === 1 ? 'siège sélectionné' : 'sièges sélectionnés'} :
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {selectedSeats.map((seat, idx) => (
                      <View key={idx} style={{ backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', fontFamily: 'Raleway-SemiBold' }}>{seat}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            // Remove this seat from the WebView cart
                            if (webviewRef.current) {
                              webviewRef.current.injectJavaScript(`
                                (function() {
                                  var seats = document.querySelectorAll('.tc_seat_in_cart');
                                  seats.forEach(function(s) {
                                    var labelEl = s.querySelector('span p');
                                    var name = labelEl ? labelEl.textContent.trim() : (s.id || '');
                                    if (name === '${seat}') {
                                      // Trigger click to remove
                                      s.click();
                                    }
                                  });
                                })();
                                true;
                              `);
                            }
                          }}
                          style={{ padding: 2 }}
                        >
                          <Text style={{ color: '#dc2626', fontSize: 16, fontWeight: 'bold', lineHeight: 16 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
              {/* Confirm button */}
              <TouchableOpacity
                style={[styles.confirmBtn, { flex: 1, backgroundColor: selectedSeats.length > 0 ? '#663d17' : '#a0a0a0' }]}
                disabled={selectedSeats.length === 0}
                onPress={() => {
                // Inject JS to extract selected seats from the Tickera DOM
                if (webviewRef.current) {
                  webviewRef.current.injectJavaScript(`
                    (function() {
                      try {
                        // Build ticket type lookup from legend / listing elements
                        var ticketTypes = {};
                        // Method 1: tc-ticket-listing elements (Tickera seating chart legend)
                        document.querySelectorAll('.tc-ticket-listing, [data-ticket-type-id]').forEach(function(el) {
                          var ttId = el.getAttribute('data-ticket-type-id');
                          var priceStr = el.getAttribute('data-tt-price') || el.getAttribute('data-price') || '';
                          var title = el.getAttribute('data-tt-title') || el.getAttribute('data-title') || el.textContent.trim().split('\\n')[0] || 'Siège';
                          var price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
                          if (ttId) ticketTypes[ttId] = { price: price, title: title };
                        });
                        
                        // Method 2: tc_in_cart items (Tickera cart summary)
                        document.querySelectorAll('.tc_in_cart .tc_cart_item, .tc_in_cart tr, .tc-cart-item').forEach(function(el) {
                          var ttId = el.getAttribute('data-ticket-type-id') || el.getAttribute('data-tt-id');
                          if (!ttId) {
                            var link = el.querySelector('a[data-ticket-type-id]');
                            if (link) ttId = link.getAttribute('data-ticket-type-id');
                          }
                          var priceEl = el.querySelector('.tc_cart_item_price, .price, td:last-child');
                          if (ttId && priceEl) {
                            var price = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
                            if (!ticketTypes[ttId] || price > 0) {
                              ticketTypes[ttId] = ticketTypes[ttId] || {};
                              if (price > 0) ticketTypes[ttId].price = price;
                            }
                          }
                        });
                        
                        var seatData = [];
                        var seen = {};
                        
                        // Find all seats that are selected/in-cart using multiple selectors
                        // ONLY select seats that Tickera has added to its WC cart
                        // tc_seat_in_cart is the class Tickera adds when user confirms via the popup
                        var seats = document.querySelectorAll('.tc_seat_in_cart');
                        
                        seats.forEach(function(seat) {
                          var ttId = seat.getAttribute('data-tt-id');
                          if (!ttId) return;
                          var seatId = seat.id || seat.getAttribute('data-seat-id') || '';
                          // Avoid duplicates
                          var key = seatId + '-' + ttId;
                          if (seen[key]) return;
                          seen[key] = true;
                          
                          // Get seat label from various possible elements
                          var labelEl = seat.querySelector('p, span, .tc_seat_label');
                          var label = labelEl ? labelEl.textContent.trim() : seatId || 'Siège';
                          var tt = ticketTypes[ttId] || { price: 0, title: 'Siège' };
                          seatData.push({
                            seatId: seatId,
                            label: label,
                            ticketTypeId: ttId,
                            ticketTypeName: tt.title || 'Siège',
                            price: tt.price || 0
                          });
                        });
                        
                        if (seatData.length > 0) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'seats_confirmed',
                            seats: seatData
                          }));
                        } else {
                          // Debug: send info about what we found in the DOM
                          var allSeats = document.querySelectorAll('.tc_seat');
                          var cartItems = document.querySelectorAll('.tc_in_cart .tc_cart_item, .tc_in_cart tr');
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'no_seats_selected',
                            debug: {
                              totalSeats: allSeats.length,
                              cartItems: cartItems.length,
                              ticketTypes: Object.keys(ticketTypes).length
                            }
                          }));
                        }
                      } catch(e) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'seat_extraction_error',
                          error: e.message
                        }));
                      }
                    })();
                    true;
                  `);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>Confirmer ma sélection</Text>
              </TouchableOpacity>
            </View>
            {selectedSeats.length === 0 && (
              <Text style={[styles.confirmHint, { color: colors.muted }]}>Appuyez sur un siège coloré pour le sélectionner</Text>
            )}
          </View>
        )}
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
          {/* COUNTDOWN - compact at top */}
          {countdown && (
            <View style={styles.countdownCompact}>
              <Text style={styles.countdownCompactText}>
                {countdown.days}j {String(countdown.hours).padStart(2,'0')}h {String(countdown.mins).padStart(2,'0')}m {String(countdown.secs).padStart(2,'0')}s
              </Text>
              <Text style={styles.countdownCompactLabel}>avant l'événement</Text>
            </View>
          )}

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
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {hasSeating ? "Types de billets disponibles" : "Types de billets"}
              </Text>
              {hasSeating && (
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10, fontFamily: "Raleway-Regular" }}>
                  La sélection se fait directement sur le plan de salle ci-dessous
                </Text>
              )}
              {tickets.map(ticket => {
                const isSelected = selectedTicket?.id === ticket.id;
                // For seated events: info-only display (no selection)
                if (hasSeating) {
                  return (
                    <View
                      key={ticket.id}
                      style={[styles.ticketOption, {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      }]}
                    >
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ticket.usesSeating ? "#c79f6c" : colors.primary, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ticketName, { color: colors.foreground }]}>{decodeHtmlEntities(ticket.name)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                          <IconSymbol name="mappin" size={10} color="#c79f6c" />
                          <Text style={{ color: "#c79f6c", fontSize: 11, marginLeft: 4, fontFamily: "Raleway-Medium" }}>Sélection sur le plan</Text>
                        </View>
                      </View>
                      <Text style={[styles.ticketPrice, { color: colors.primary }]}>{formatAriary(ticket.price)}</Text>
                    </View>
                  );
                }
                // For non-seated events: normal selection with radio
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
                    </View>
                    <Text style={[styles.ticketPrice, { color: colors.primary }]}>{formatAriary(ticket.price)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Seating Chart Button */}
          {hasSeating && (
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
              <Text style={styles.seatingChartBtnText}>{seatingLoading ? "Chargement..." : "Voir le plan de salle & choisir mon si\u00e8ge"}</Text>
            </TouchableOpacity>
          )}

          {/* Quantity (for non-seating tickets only) */}
          {selectedTicket && !hasSeating && (
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

          {/* Old countdown removed - now at top */}

          {/* CONDITIONS */}
          {event.mobileFields?.event_terms ? (
            <View style={[styles.conditionsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Conditions</Text>
              <Text style={[styles.conditionsTitle, { color: colors.primary }]}>Termes et conditions :</Text>
              <Text style={[styles.descText, { color: colors.muted }]} numberOfLines={showFullTerms ? undefined : 3}>
                {event.mobileFields.event_terms}
              </Text>
              {event.mobileFields.event_terms.length > 150 && (
                <TouchableOpacity onPress={() => setShowFullTerms(!showFullTerms)}>
                  <Text style={[styles.showMoreText, { color: colors.primary }]}>{showFullTerms ? 'Voir moins' : 'Voir plus'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* LOCATION ON MAP */}
          {event.mobileFields?.event_location ? (
            <View style={[styles.locationBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.locationHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Lieu</Text>
                <TouchableOpacity onPress={() => {
                  const q = encodeURIComponent(event.mobileFields!.event_location!);
                  Linking.openURL(Platform.OS === 'ios' ? `maps:?q=${q}` : `geo:0,0?q=${q}`);
                }}>
                  <Text style={[styles.getDirections, { color: colors.primary }]}>Itinéraire</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.locationRow}>
                <IconSymbol name="mappin" size={16} color={colors.primary} />
                <Text style={[styles.locationText, { color: colors.foreground }]}>{event.mobileFields.event_location}</Text>
              </View>
              {/* Static map preview */}
              <TouchableOpacity
                onPress={() => {
                  const q = encodeURIComponent(event.mobileFields!.event_location!);
                  Linking.openURL(Platform.OS === 'ios' ? `maps:?q=${q}` : `geo:0,0?q=${q}`);
                }}
                style={styles.mapPreview}
              >
                <Image
                  source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(event.mobileFields.event_location)}&zoom=15&size=600x200&markers=color:red%7C${encodeURIComponent(event.mobileFields.event_location)}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8` }}
                  style={styles.mapImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* UPCOMING EVENTS */}
          {upcomingEvents.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <View style={styles.upcomingHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Événements à venir</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/events' as any)}>
                  <Text style={[styles.getDirections, { color: colors.primary }]}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={upcomingEvents}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16, gap: 12, marginTop: 12 }}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/event/${item.id}` as any)}
                    style={[styles.upcomingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Image source={{ uri: item.featuredImage }} style={styles.upcomingCardImage} contentFit="cover" />
                    <View style={styles.upcomingCardBody}>
                      <Text style={[styles.upcomingCardTitle, { color: colors.foreground }]} numberOfLines={2}>
                        {decodeHtmlEntities(item.title.rendered)}
                      </Text>
                      {item.mobileFields?.event_location && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <IconSymbol name="mappin" size={11} color={colors.muted} />
                          <Text style={{ color: colors.muted, fontSize: 11, fontFamily: 'Raleway-Regular' }} numberOfLines={1}>
                            {item.mobileFields.event_location}
                          </Text>
                        </View>
                      )}
                      {item.minPrice != null && (
                        <Text style={[styles.upcomingCardPrice, { color: colors.primary }]}>
                          Dès {formatAriary(item.minPrice)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {hasSeating ? (
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
            <Text style={styles.ctaButtonText}>{seatingLoading ? "Chargement du plan..." : "Choisir mon si\u00e8ge"}</Text>
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
                : "S\u00e9lectionnez un billet"}
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
  confirmOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: "#E5E7EB", alignItems: "center" },
  confirmBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Raleway-Bold" },
  confirmHint: { marginTop: 6, fontSize: 12, fontFamily: "Raleway-Regular", textAlign: "center" },
  // Countdown (compact at top)
  countdownCompact: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#663d17" },
  countdownCompactText: { fontSize: 14, fontWeight: "700", fontFamily: "Raleway-Bold", color: "#fff", letterSpacing: 0.5 },
  countdownCompactLabel: { fontSize: 12, fontFamily: "Raleway-Regular", color: "rgba(255,255,255,0.75)" },
  // Conditions
  conditionsBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  conditionsTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold", marginBottom: 6 },
  showMoreText: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold", marginTop: 8 },
  // Location
  locationBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  locationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  getDirections: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  locationText: { fontSize: 14, fontFamily: "Raleway-Medium", flex: 1 },
  mapPreview: { borderRadius: 10, overflow: "hidden" },
  mapImage: { width: "100%", height: 140, borderRadius: 10 },
  // Upcoming events
  upcomingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  upcomingCard: { width: 200, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  upcomingCardImage: { width: 200, height: 110 },
  upcomingCardBody: { padding: 10 },
  upcomingCardTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Raleway-SemiBold" },
  upcomingCardPrice: { fontSize: 13, fontWeight: "700", fontFamily: "Raleway-Bold", marginTop: 6 },
});

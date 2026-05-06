import { useEffect, useState, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet, FlatList, Platform, Linking, Share, Alert } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getTCEvent, getEventTickets, getEventsData, clearServerCart, createOrder, SITE_URL as API_SITE_URL, type TCEvent, type TicketType } from "@/lib/api/woocommerce";
import { useAuth } from "@/lib/auth-provider";
import { getStoredToken, getStoredUser } from "@/lib/api/auth";
import { useFavorites } from "@/lib/favorites-provider";
import { formatAriary, formatDate, formatDateShort, stripHtml, decodeHtmlEntities } from "@/lib/format";
import { LinearGradient } from "expo-linear-gradient";
import { PointsBadge } from "@/components/points-badge";
import { CartToast } from "@/components/cart-toast";
import { SeatingChartSkeleton } from "@/components/skeleton-loader";
import { Confetti } from "@/components/confetti";

const { width: SCREEN_W } = Dimensions.get("window");
const SITE_URL = API_SITE_URL;

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
  const { isAuthenticated } = useAuth();
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
  const [showCartToast, setShowCartToast] = useState(false);
  const [cartToastName, setCartToastName] = useState("");

  useEffect(() => {
    if (!id) return;
    const eventId = Number(id);
    
    // Strategy: Use cached events-data for instant display, fetch full details in parallel
    // This avoids the slow getProducts(per_page=100) call that was causing 1min+ load times
    getEventsData().then(({ events: allEvents }) => {
      // Try to get event + tickets from cached data (instant if coming from events list)
      const cachedEvent = allEvents.find(e => e.id === eventId);
      if (cachedEvent) {
        setEvent(cachedEvent);
        if (cachedEvent.tickets && cachedEvent.tickets.length > 0) {
          setTickets(cachedEvent.tickets);
          if (cachedEvent.tickets.length === 1) setSelectedTicket(cachedEvent.tickets[0]);
        }
        setLoading(false);
      }
      
      // Set upcoming events
      const now = Date.now();
      const upcoming = allEvents.filter(e => {
        if (e.id === eventId) return false;
        const dt = e.mobileFields?.event_date_time;
        if (!dt) return true;
        return new Date(dt.replace(' ', 'T')).getTime() > now;
      }).slice(0, 8);
      setUpcomingEvents(upcoming);
      
      // If event not found in cache, fall back to individual API calls
      if (!cachedEvent) {
        Promise.all([
          getTCEvent(eventId),
          getEventTickets(eventId),
        ]).then(([ev, tix]) => {
          setEvent(ev);
          setTickets(tix);
          if (tix.length === 1) setSelectedTicket(tix[0]);
          setLoading(false);
        }).catch(() => setLoading(false));
      }
    }).catch(() => {
      // If events-data fails, fall back to individual API calls
      Promise.all([
        getTCEvent(eventId),
        getEventTickets(eventId),
      ]).then(([ev, tix]) => {
        setEvent(ev);
        setTickets(tix);
        if (tix.length === 1) setSelectedTicket(tix[0]);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
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
        <Text style={{ color: colors.muted }}>Événement introuvable</Text>
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
    const itemName = `${name} - ${selectedTicket.name}`;
    addItem({
      productId: selectedTicket.id,
      name: itemName,
      price: parseFloat(selectedTicket.price) || 0,
      image: event.featuredImage || "",
      quantity: qty,
      isEvent: true,
    });
    setCartToastName(itemName);
    setShowCartToast(true);
    // Navigate to cart after toast animation
    setTimeout(() => {
      router.push("/(tabs)/cart" as any);
    }, 1200);
  };

  const handleOpenSeatingChart = async () => {
    if (!hasSeating || !event) return;
    
    // REQUIRE AUTH: User must be logged in before opening seating chart
    // This prevents the admin login exposure issue and ensures WC session is linked to user
    if (!isAuthenticated) {
      Alert.alert(
        "Connexion requise",
        "Vous devez être connecté pour réserver des sièges.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/(auth)/login" as any) },
        ]
      );
      return;
    }
    
    setSeatingLoading(true);
    try {
      // CRITICAL: Clear WooCommerce cart + release Tickera seats BEFORE opening seating chart
      clearCart();
      try {
        await clearServerCart(undefined, String(event.id));
      } catch (e) {
        console.warn('Failed to clear server cart before seating:', e);
      }

      // BilletClic approach: Load the EVENT PAGE directly in the WebView
      // Tickera displays the seating chart button on the event page natively
      // The user clicks "CHOISIR MA PLACE" → seating popup opens → selects seats →
      // confirms → cart → checkout → payment - ALL within the same WebView session
      const eventPageUrl = event.link || `${SITE_URL}/tc-events/${event.slug}/`;
      
      // Use auto-login URL to pre-authenticate the WebView session
      // This ensures the user is logged in for checkout (no login form exposed)
      const token = await getStoredToken();
      if (token) {
        const autoLoginUrl = `${SITE_URL}/wp-json/lamako-mobile/v1/auto-login?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(eventPageUrl)}`;
        setSeatingChartUrl(autoLoginUrl);
      } else {
        setSeatingChartUrl(eventPageUrl);
      }
      
      setShowSeatingChart(true);
      setWebviewPhase('seating');
      setSelectedSeats([]);
    } catch (e) {
      console.warn("Seating chart open error:", e);
      const eventPageUrl = event.link || `${SITE_URL}/tc-events/${event.slug}/`;
      setSeatingChartUrl(eventPageUrl);
      setShowSeatingChart(true);
      setWebviewPhase('seating');
    } finally {
      setSeatingLoading(false);
    }
  };

  // Seating Chart WebView - loads the tc_seat_charts page directly (same approach as POS plugin)
  if (showSeatingChart && event && seatingChartUrl) {
    // BilletClic approach: Load the full event page in WebView
    // User interacts naturally: clicks "CHOISIR MA PLACE" → seating chart popup opens → selects seats → 
    // confirms → goes to cart → checkout → payment - ALL within the same WebView session
    const injectedJS = `
      (function() {
        var isEventPage = window.location.href.indexOf('/tc-events/') > -1 || window.location.href.indexOf('/tc_event/') > -1;
        var isCartPage = (window.location.href.indexOf('/cart') > -1 || window.location.href.indexOf('/panier') > -1) && window.location.href.indexOf('/checkout') === -1;
        var isCheckoutPage = window.location.href.indexOf('/checkout') > -1 || window.location.href.indexOf('/commande') > -1;
        var isOrderReceived = window.location.href.indexOf('order-received') > -1 || window.location.href.indexOf('commande-recue') > -1 || window.location.href.indexOf('thankyou') > -1;
        var is404 = false;

        function cleanup() {
          // Check for 404
          if (document.title.indexOf('404') > -1 || document.querySelector('.error-404, .not-found')) {
            is404 = true;
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'order_confirmed' }));
            }
            return;
          }

          // === GLOBAL: Hide all non-essential elements on every page ===
          var globalStyle = document.createElement('style');
          globalStyle.textContent = 
            'header, .site-header, #masthead, .header-wrapper, .header-main, .header-top, .header-bottom,' +
            'footer, .site-footer, #colophon, .footer-wrapper, .absolute-footer,' +
            'nav:not(.tc-nav):not(.woocommerce-pagination), .breadcrumbs, .woocommerce-breadcrumb, #wpadminbar,' +
            '.sidebar, #sidebar, aside,' +
            '[class*="whatsapp"], .joinchat, [id*="whatsapp"],' +
            '[class*="cookie"], [class*="consent"],' +
            '#fkcart-floating-toggler, .fkcart-main-wrapper,' +
            '[class*="tidio"], [id*="tidio"], [class*="chat-widget"],' +
            '[class*="crisp"], [id*="crisp"],' +
            '[class*="tawk"], [id*="tawk"],' +
            '.related, .upsells, .cross-sells' +
            '{ display: none !important; }' +
            'body { margin-top: 0 !important; padding-top: 0 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; }' +
            '.tc_zoom_in, .tc_zoom_out, .tc-zoom-in, .tc-zoom-out, [class*="zoom"] { display: block !important; visibility: visible !important; }';
          document.head.appendChild(globalStyle);

          // === EVENT PAGE: Show only featured image + auto-click seating chart button ===
          if (isEventPage) {
            var eventStyle = document.createElement('style');
            eventStyle.textContent = 
              /* Hide everything in the content area */
              '.entry-content > *, .tc_event_content > *, .post-content > *, .single-content > *,' +
              '.tc_event_details, .tc_event_description, .tc_event_meta, .tc_event_info,' +
              '.tc_event_date, .tc_event_location, .tc_event_organizer,' +
              '.tc_ticket_type_table, .tc_tickets_wrapper, .tc_add_to_cart,' +
              '.event-meta, .event-details, .event-description,' +
              '.qode-single-event-holder, .qode-event-info,' +
              'h1, h2, h3, .entry-title, .page-title,' +
              '.comments-area, #comments, .comment-respond,' +
              '.post-navigation, .nav-links,' +
              '.share-buttons, .social-share, [class*="share"],' +
              '.woocommerce-tabs, .tabs-container' +
              '{ display: none !important; }' +
              /* Show only the featured image */
              '.post-thumbnail, .wp-post-image, .tc_event_featured_image, .attachment-full,' +
              'img.wp-post-image, .entry-thumbnail, .single-post-thumbnail,' +
              '.qode-event-image, [class*="featured-image"], [class*="event-image"]' +
              '{ display: block !important; width: 100% !important; height: auto !important; max-height: 250px !important; object-fit: cover !important; border-radius: 0 !important; margin: 0 !important; }' +
              /* Show the Tickera seating chart button */
              '.tc_seat_chart_button, .tc_buy_tickets_button, [class*="tc_seat"], [class*="choose-seat"],' +
              'a[href*="seat"], button[class*="seat"], .tc_open_seat_chart,' +
              '.tc_event_buy_button, .tc_add_to_cart_button' +
              '{ display: block !important; visibility: visible !important; margin: 16px auto !important; padding: 14px 24px !important; font-size: 17px !important; font-weight: 600 !important; text-align: center !important; border-radius: 12px !important; }' +
              /* Show the Tickera seating chart popup/modal when opened */
              '.tc_seat_chart_wrap, .tc_seat_chart_modal, .tc_seat_chart_container,' +
              '#tc_seat_chart_modal, [class*="tc_seat_chart"], .tc-seat-chart,' +
              '.tc_seating_chart, #tc_seating_chart, .fancybox-overlay, .fancybox-wrap,' +
              '.tc-modal, [id*="tc_seat"]' +
              '{ display: block !important; visibility: visible !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 99999 !important; }' +
              /* Loading indicator while waiting for auto-click */
              '.lamako-loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #fff; display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: 9998; }' +
              '.lamako-loading-spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #c79f6c; border-radius: 50%; animation: spin 0.8s linear infinite; }' +
              '@keyframes spin { to { transform: rotate(360deg); } }' +
              '.lamako-loading-text { margin-top: 12px; font-size: 14px; color: #687076; }';
            document.head.appendChild(eventStyle);

            // Add a loading overlay while we wait for the button
            var overlay = document.createElement('div');
            overlay.className = 'lamako-loading-overlay';
            overlay.innerHTML = '<div class="lamako-loading-spinner"></div><div class="lamako-loading-text">Chargement du plan de salle...</div>';
            document.body.appendChild(overlay);

            // Auto-click the seating chart button
            function tryClickSeatButton() {
              var selectors = [
                '.tc_seat_chart_button',
                '.tc_buy_tickets_button', 
                '.tc_open_seat_chart',
                '.tc_event_buy_button',
                'a[href*="seat-chart"]',
                'a[href*="seat_chart"]',
                '.tc_add_to_cart_button',
                'a[class*="tc_seat"]',
                'button[class*="seat"]',
                '.tc_event_content a.button',
                '.tc_event_content .btn',
                'a[href*="choose"]'
              ];
              for (var i = 0; i < selectors.length; i++) {
                var btn = document.querySelector(selectors[i]);
                if (btn) {
                  // Remove overlay
                  var ov = document.querySelector('.lamako-loading-overlay');
                  if (ov) ov.style.display = 'none';
                  // Click the button
                  btn.click();
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'seat_chart_opened' }));
                  }
                  return true;
                }
              }
              return false;
            }

            // Try immediately, then retry every 500ms for up to 10 seconds
            if (!tryClickSeatButton()) {
              var attempts = 0;
              var maxAttempts = 20;
              var interval = setInterval(function() {
                attempts++;
                if (tryClickSeatButton() || attempts >= maxAttempts) {
                  clearInterval(interval);
                  // If button never found, remove overlay and show page
                  if (attempts >= maxAttempts) {
                    var ov = document.querySelector('.lamako-loading-overlay');
                    if (ov) ov.style.display = 'none';
                  }
                }
              }, 500);
            }
          }

          // === CART PAGE: Mobile-friendly styles ===
          if (isCartPage) {
            var cartStyle = document.createElement('style');
            cartStyle.textContent = 
              'body { font-size: 15px !important; }' +
              '.woocommerce-cart { padding: 12px !important; }' +
              'table.shop_table { font-size: 14px !important; }' +
              '.checkout-button, .wc-proceed-to-checkout a { font-size: 17px !important; padding: 14px 24px !important; border-radius: 12px !important; display: block !important; text-align: center !important; }';
            document.head.appendChild(cartStyle);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'checkout_loaded' }));
            }
          }

          // === CHECKOUT PAGE: Mobile-friendly styles ===
          if (isCheckoutPage) {
            var checkoutStyle = document.createElement('style');
            checkoutStyle.textContent = 
              'body { font-size: 15px !important; }' +
              '.woocommerce-checkout { padding: 12px !important; }' +
              '.woocommerce-form-coupon-toggle { display: none !important; }' +
              'table.shop_table { font-size: 14px !important; }' +
              '#payment { margin-top: 16px !important; }' +
              '#place_order { font-size: 17px !important; padding: 14px !important; border-radius: 12px !important; }';
            document.head.appendChild(checkoutStyle);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'checkout_loaded' }));
            }
          }

          // === ORDER RECEIVED: Notify app of success ===
          if (isOrderReceived) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'order_confirmed' }));
            }
          }
        }

        if (document.readyState === 'complete') setTimeout(cleanup, 300);
        else window.addEventListener('load', function() { setTimeout(cleanup, 300); });
        // Also run on DOMContentLoaded for faster response
        document.addEventListener('DOMContentLoaded', function() { setTimeout(cleanup, 200); });
      })();
      true;
    `;

    // Header title and icon based on current phase
    const headerTitle = webviewPhase === 'seating' ? 'Billetterie' 
      : webviewPhase === 'checkout' ? 'Paiement s\u00e9curis\u00e9' 
      : 'Confirmation';
    const headerIcon = webviewPhase === 'checkout' ? 'lock.fill' : webviewPhase === 'confirmation' ? 'checkmark.circle.fill' : undefined;
    
    if (Platform.OS === "web") {
      return (
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={[styles.seatingHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowSeatingChart(false); }} style={styles.seatingBackBtn}>
              <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
              <Text style={[styles.seatingBackText, { color: colors.foreground }]}>Retour</Text>
            </TouchableOpacity>
            <Text style={[styles.seatingTitle, { color: colors.foreground }]}>Billetterie</Text>
            <View style={{ width: 80 }} />
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Text style={{ color: colors.muted, textAlign: "center" }}>
              La billetterie interactive n'est pas disponible sur le web.{"\n"}Ouvrez l'app sur votre t\u00e9l\u00e9phone ou utilisez le site web.
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
              clearCart();
              setShowSeatingChart(false);
              setWebviewPhase('seating');
              router.replace("/(tabs)/tickets");
            } else {
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
          {/* Seat count badge */}
          {selectedSeats.length > 0 && webviewPhase === 'seating' ? (
            <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{selectedSeats.length} siège{selectedSeats.length > 1 ? 's' : ''}</Text>
            </View>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
        {webviewPhase === 'confirmation' && <Confetti active={true} />}
        <View style={{ flex: 1 }}>
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
            allowsBackForwardNavigationGestures={true}
            bounces={false}
            scrollEnabled={true}
            injectedJavaScript={injectedJS}
            renderLoading={() => (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <SeatingChartSkeleton />
              </View>
            )}
            onMessage={(e: any) => {
              try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'SEATS_CONFIRMED') {
                  // BilletClic approach: Don't intercept - let the user flow naturally
                  // through cart → checkout in the WebView. The auto-login ensures
                  // the user is already authenticated for the entire flow.
                  // Just update the phase for the header UI
                  setWebviewPhase('checkout');
                }
                if (data.type === 'checkout_loaded') {
                  setWebviewPhase('checkout');
                }
                if (data.type === 'order_confirmed' || data.type === 'payment_success') {
                  setWebviewPhase('confirmation');
                  clearCart();
                }
                if (data.type === 'seat_count_update') {
                  setSelectedSeats(data.seats || []);
                }
              } catch {}
            }}
            onNavigationStateChange={(navState: any) => {
              const url = navState.url || "";
              // Detect cart/checkout pages
              if (url.includes('/cart') || url.includes('/panier') || url.includes('/checkout') || url.includes('/commande') || url.includes('lamako_checkout')) {
                setWebviewPhase('checkout');
              }
              // Detect order confirmation page
              if (url.includes("order-received") || url.includes("commande-recue") || url.includes("thankyou")) {
                setWebviewPhase('confirmation');
                clearCart();
              }
              // Detect if user navigated back to event page (reset phase)
              if (url.includes('/tc-events/') || url.includes('/tc_event/') || url.includes('lamako_seat_embed') || url.includes('seat-chart')) {
                setWebviewPhase('seating');
              }
              // Handle 404 page after payment gateway return (Orange Money)
              // Instead of just showing confirmation, redirect to lamako_checkout to verify order status
              if ((url.includes('404') || url.includes('page-not-found')) && webviewPhase === 'checkout') {
                // The PHP lamako_checkout handler now checks if order is paid and shows success
                setWebviewPhase('confirmation');
                clearCart();
              }
              // Handle homepage redirect after payment (gateway return)
              const isHomepage = url.match(/^https:\/\/www\.ticketbylamako\.com\/?$/);
              if (isHomepage && webviewPhase === 'checkout') {
                setWebviewPhase('confirmation');
                clearCart();
              }
            }}
            onShouldStartLoadWithRequest={(request: any) => {
              const url = request.url || "";
              // Allow all HTTPS navigation (payment gateways return to various domains)
              if (url.startsWith("https://") || url.startsWith("http://")) return true;
              if (url.startsWith("about:") || url.startsWith("data:")) return true;
              return false;
            }}
          />
          {/* Zoom controls overlay - only show during seating phase */}
          {webviewPhase === 'seating' && (
            <View style={{ position: 'absolute', bottom: 80, right: 16, gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (webviewRef.current) {
                    webviewRef.current.injectJavaScript(`
                      var zoomIn = document.querySelector('.tc_zoom_in, .tc-zoom-in, [class*="zoom_in"], .tc_seating_chart_zoom_in');
                      if (zoomIn) zoomIn.click();
                      true;
                    `);
                  }
                }}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <IconSymbol name="plus" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (webviewRef.current) {
                    webviewRef.current.injectJavaScript(`
                      var zoomOut = document.querySelector('.tc_zoom_out, .tc-zoom-out, [class*="zoom_out"], .tc_seating_chart_zoom_out');
                      if (zoomOut) zoomOut.click();
                      true;
                    `);
                  }
                }}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <IconSymbol name="minus" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <CartToast
        visible={showCartToast}
        itemName={cartToastName}
        onHide={() => setShowCartToast(false)}
      />
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
              <PointsBadge
                price={tickets.length === 1 ? tickets[0].price : Math.min(...tickets.map(t => parseFloat(t.price) || 0))}
                compact={false}
              />
            </View>
          )}

          {/* Ticket Types */}
          {tickets.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {hasSeating ? "Types de billets disponibles" : "Types de billets"}
              </Text>
              {hasSeating && (
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
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
                          <Text style={{ color: "#c79f6c", fontSize: 11, marginLeft: 4 }}>Sélection sur le plan</Text>
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
                          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
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
  seatingOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700" },
  catsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  catsText: { fontSize: 13, fontWeight: "600" },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 14 },
  infoItem: { flexDirection: "row", alignItems: "center" },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 13, fontWeight: "600" },
  practicalInfoBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  practicalInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  practicalInfoLabel: { fontSize: 13, flex: 1 },
  practicalInfoValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  priceBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  priceLabel: { fontSize: 13, fontWeight: "600" },
  priceValue: { fontSize: 28, fontWeight: "800", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  ticketOption: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  ticketName: { fontSize: 14, fontWeight: "600" },
  ticketPrice: { fontSize: 15, fontWeight: "700" },
  seatingChartBtn: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 12 },
  seatingChartBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1 },
  qtyLabel: { fontSize: 15, fontWeight: "600" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 16 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 20, fontWeight: "700" },
  qtyValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  descText: { fontSize: 14, lineHeight: 22 },
  bottomCta: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  ctaButton: { borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  ctaButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  galleryDots: { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  seatingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  seatingBackBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  seatingBackText: { fontSize: 15 },
  seatingTitle: { fontSize: 16, fontWeight: "700" },
  webFallbackBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  webFallbackBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  topRightActions: { position: "absolute", top: 12, right: 16, flexDirection: "row", gap: 8 },
  topActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  confirmOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: "#E5E7EB", alignItems: "center" },
  confirmBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  confirmHint: { marginTop: 6, fontSize: 12, textAlign: "center" },
  // Countdown (compact at top)
  countdownCompact: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#663d17" },
  countdownCompactText: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  countdownCompactLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  // Conditions
  conditionsBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  conditionsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  showMoreText: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  // Location
  locationBox: { marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  locationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  getDirections: { fontSize: 13, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  locationText: { fontSize: 14, flex: 1 },
  mapPreview: { borderRadius: 10, overflow: "hidden" },
  mapImage: { width: "100%", height: 140, borderRadius: 10 },
  // Upcoming events
  upcomingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  upcomingCard: { width: 200, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  upcomingCardImage: { width: 200, height: 110 },
  upcomingCardBody: { padding: 10 },
  upcomingCardTitle: { fontSize: 13, fontWeight: "600" },
  upcomingCardPrice: { fontSize: 13, fontWeight: "700", marginTop: 6 },
});

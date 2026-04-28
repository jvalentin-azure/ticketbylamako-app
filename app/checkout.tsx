import { useState, useRef, useEffect } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { getStoredUser } from "@/lib/api/auth";
import { createOrder, SITE_URL } from "@/lib/api/woocommerce";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatAriary } from "@/lib/format";

// WebView for checkout - loads WooCommerce pay-for-order page
let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComponent = require("react-native-webview").default;
  } catch {}
}

type CheckoutPhase = "creating" | "paying" | "success" | "error";

export default function CheckoutScreen() {
  const colors = useColors();
  const router = useRouter();
  const { items, clearCart, total } = useCart();
  const webviewRef = useRef<any>(null);
  const [phase, setPhase] = useState<CheckoutPhase>("creating");
  const [checkoutUrl, setCheckoutUrl] = useState<string>("");
  const [orderId, setOrderId] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [webviewLoading, setWebviewLoading] = useState(true);

  // Create WC order on mount
  useEffect(() => {
    let cancelled = false;
    async function initOrder() {
      try {
        if (items.length === 0) {
          setErrorMsg("Votre panier est vide");
          setPhase("error");
          return;
        }

        // Get user info for billing
        const user = await getStoredUser();
        const billing = {
          first_name: user?.firstName || "Client",
          last_name: user?.lastName || "Mobile",
          email: user?.email || "",
          phone: "",
        };

        // Map cart items to order items
        const orderItems = items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
        }));

        // Create the order via our WordPress API
        const result = await createOrder(orderItems, billing, user?.id);

        if (cancelled) return;

        if (result.checkout_url) {
          setOrderId(result.order_id);
          setCheckoutUrl(result.checkout_url);
          setPhase("paying");
        } else {
          setErrorMsg("Impossible de créer la commande. Veuillez réessayer.");
          setPhase("error");
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("Create order error:", err);
        setErrorMsg(err?.message || "Erreur lors de la création de la commande");
        setPhase("error");
      }
    }
    initOrder();
    return () => { cancelled = true; };
  }, []);

  const handleNavChange = (navState: any) => {
    const url = navState.url || "";
    // Detect order confirmation page
    if (url.includes("order-received") || url.includes("commande-recue") || url.includes("thankyou")) {
      setPhase("success");
      clearCart();
    }
  };

  // Handle messages from the checkout WebView (e.g. payment success)
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "payment_success") {
        setPhase("success");
        clearCart();
      }
    } catch {}
  };

  // JS injection for checkout WebView:
  // 1. On dedicated checkout page: just hide stray widgets
  // 2. On WooCommerce order-received page (after payment gateway redirect): hide full theme, show clean success
  // 3. On any other WC page: hide theme elements
  const checkoutInjectedJS = `
    (function() {
      var url = window.location.href;
      
      // Detect order-received / thank-you page (after payment gateway redirect)
      var isOrderReceived = url.indexOf('order-received') > -1 || url.indexOf('commande-recue') > -1 || url.indexOf('thankyou') > -1;
      
      if (isOrderReceived) {
        // Notify the React Native app immediately
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', url: url }));
        }
        // Also inject a clean success page style to hide the WordPress theme
        var style = document.createElement('style');
        style.textContent = 
          'header, .site-header, #masthead, .header-wrapper, .header-main, .header-top, .header-bottom,' +
          'footer, .site-footer, #colophon, .footer-wrapper, .absolute-footer,' +
          'nav, .navigation, .nav-links, .breadcrumbs, .woocommerce-breadcrumb, #wpadminbar,' +
          '.sidebar, #sidebar, aside,' +
          '[class*="whatsapp"], .joinchat, [id*="whatsapp"],' +
          '[class*="cookie"], [class*="consent"],' +
          '#fkcart-floating-toggler, .fkcart-main-wrapper, [class*="fkcart"],' +
          '[class*="tidio"], [id*="tidio"], [class*="chat-widget"],' +
          '[class*="crisp"], [id*="crisp"],' +
          '[class*="tawk"], [id*="tawk"],' +
          '.wc-block-mini-cart, .wp-block-woocommerce-mini-cart,' +
          '.page-title-inner, .page-title,' +
          '.comments-area, #comments' +
          '{ display: none !important; }' +
          'body { background: #f5f5f5 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; }' +
          '.woocommerce-order { max-width: 100% !important; padding: 20px !important; }' +
          '.woocommerce-thankyou-order-received { font-size: 18px !important; font-weight: 700 !important; color: #22c55e !important; text-align: center !important; padding: 20px 0 !important; }' +
          '.woocommerce-order-details, .woocommerce-customer-details { margin: 16px 0 !important; padding: 16px !important; background: #fff !important; border-radius: 12px !important; }' +
          'table.woocommerce-table { font-size: 14px !important; }' +
          '#content, .site-content, main, .main-content, .entry-content { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }';
        document.head.appendChild(style);
        return;
      }
      
      // For all other pages (dedicated checkout, payment gateway pages, etc.)
      function cleanup() {
        var hide = '#wpadminbar, .qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"], [class*="tidio"], [class*="whatsapp"], [class*="tawk"], [class*="crisp"]';
        document.querySelectorAll(hide).forEach(function(el) { el.style.display = 'none'; });
        // Ensure place_order button is visible on checkout page
        var btn = document.getElementById('place_order');
        if (btn) { btn.removeAttribute('hidden'); btn.style.display = 'block'; }
      }
      cleanup();
      setTimeout(cleanup, 500);
      setTimeout(cleanup, 1500);
      setTimeout(cleanup, 3000);
      setInterval(cleanup, 5000);
      
      // Also check for order-received after page loads (in case of client-side redirect)
      function checkSuccess() {
        var u = window.location.href;
        if (u.indexOf('order-received') > -1 || u.indexOf('commande-recue') > -1 || u.indexOf('thankyou') > -1) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', url: u }));
          }
        }
      }
      window.addEventListener('load', checkSuccess);
      // MutationObserver to detect dynamic page changes
      var obs = new MutationObserver(checkSuccess);
      obs.observe(document.body, { childList: true, subtree: true });
    })();
    true;
  `;

  // ---- CREATING phase ----
  if (phase === "creating") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Préparation...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>Création de votre commande...</Text>
          <Text style={[styles.loadingSubtext, { color: colors.muted }]}>
            {items.length} article{items.length > 1 ? "s" : ""} · {formatAriary(total)}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // ---- ERROR phase ----
  if (phase === "error") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Erreur</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol name="xmark.circle.fill" size={56} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Impossible de procéder au paiement</Text>
          <Text style={[styles.errorMsg, { color: colors.muted }]}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => { setPhase("creating"); setErrorMsg(""); }}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: colors.muted }]}>Retour au panier</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- SUCCESS phase ----
  if (phase === "success") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.centerContent}>
          <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Commande confirmée !</Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>
            Votre commande #{orderId} a été enregistrée. Vous recevrez un email de confirmation.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/" as any)}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace("/orders" as any)}
            style={[styles.backLink, { marginTop: 12 }]}
          >
            <Text style={[styles.backLinkText, { color: colors.primary }]}>Voir mes commandes</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- PAYING phase (WebView) ----
  if (Platform.OS === "web" || !WebViewComponent) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Paiement sécurisé</Text>
          <IconSymbol name="lock.fill" size={16} color={colors.success} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol name="lock.fill" size={48} color={colors.primary} />
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Paiement sécurisé</Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>
            Commande #{orderId} · {formatAriary(total)}
          </Text>
          <TouchableOpacity
            onPress={() => { if (typeof window !== "undefined") window.open(checkoutUrl, "_blank"); }}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Ouvrir le paiement</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          Alert.alert(
            "Annuler le paiement ?",
            "Votre commande sera conservée. Vous pourrez la payer plus tard.",
            [
              { text: "Continuer le paiement", style: "cancel" },
              { text: "Quitter", style: "destructive", onPress: () => router.back() },
            ]
          );
        }} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <IconSymbol name="lock.fill" size={14} color={colors.success} />
          <Text style={[styles.headerTitle, { color: colors.foreground, marginLeft: 6 }]}>Paiement sécurisé</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      {webviewLoading && (
        <View style={styles.webviewLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <WebViewComponent
        ref={webviewRef}
        source={{ uri: checkoutUrl }}
        onLoadEnd={() => setWebviewLoading(false)}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={(request: any) => {
          const url = request.url || "";
          // Allow same site, payment gateways, and common payment providers
          if (url.startsWith(SITE_URL)) return true;
          if (url.includes("mvola") || url.includes("orange") || url.includes("airtel")) return true;
          if (url.includes("cybersource") || url.includes("visa") || url.includes("mastercard")) return true;
          if (url.includes("paypal") || url.includes("stripe")) return true;
          // Block external navigation
          return false;
        }}
        injectedJavaScript={checkoutInjectedJS}
        onMessage={handleWebViewMessage}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Raleway-Bold" },
  backBtn: { width: 40, alignItems: "flex-start" },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  loadingText: { fontSize: 17, fontWeight: "600", marginTop: 20, fontFamily: "Raleway-SemiBold" },
  loadingSubtext: { fontSize: 14, marginTop: 6, fontFamily: "Raleway-Regular" },
  errorTitle: { fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center", fontFamily: "Raleway-Bold" },
  errorMsg: { fontSize: 14, marginTop: 8, textAlign: "center", fontFamily: "Raleway-Regular" },
  retryBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 },
  retryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Raleway-Bold" },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 14, fontFamily: "Raleway-Medium" },
  successTitle: { fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center", fontFamily: "Raleway-Bold" },
  successSub: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20, fontFamily: "Raleway-Regular" },
  webviewLoader: { position: "absolute", top: 60, left: 0, right: 0, zIndex: 10, alignItems: "center" },
});

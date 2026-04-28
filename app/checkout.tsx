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

  // Inject CSS to make the checkout page mobile-friendly
  const checkoutInjectedJS = `
    (function() {
      var style = document.createElement('style');
      style.textContent = \`
        /* Hide site chrome */
        header, .site-header, #masthead, .header-wrapper,
        footer, .site-footer, #colophon, .footer-wrapper,
        nav, .navigation, .breadcrumbs, .woocommerce-breadcrumb,
        #wpadminbar, .header-main, .header-top, .header-bottom,
        .footer-1, .footer-2, .absolute-footer,
        .page-title-inner, .page-title,
        [class*="whatsapp"], .qlwapp__container, [class*="qlwapp"],
        [class*="cookie"], [class*="consent"],
        #fkcart-floating-toggler, #fkcart-modal, [class*="fkcart"],
        [class*="tidio"], [id*="tidio"],
        .wc-block-mini-cart, .wp-block-woocommerce-mini-cart,
        .sidebar, #sidebar, aside
        { display: none !important; }
        
        body { 
          margin: 0 !important; 
          padding: 8px !important; 
          background: #fff !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        .woocommerce { max-width: 100% !important; padding: 0 !important; }
        #order_review, .woocommerce-checkout-payment { max-width: 100% !important; }
        
        /* Make payment methods more touch-friendly */
        .wc_payment_methods li { padding: 12px !important; margin-bottom: 8px !important; }
        .wc_payment_methods label { font-size: 16px !important; }
        #place_order { 
          font-size: 18px !important; 
          padding: 16px !important; 
          border-radius: 12px !important;
          width: 100% !important;
        }
      \`;
      document.head.appendChild(style);
      
      // Hide widgets that load late
      setInterval(function() {
        var widgets = document.querySelectorAll('.qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"]');
        widgets.forEach(function(w) { w.style.display = 'none'; });
      }, 2000);
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

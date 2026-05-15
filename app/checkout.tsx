import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { getStoredUser } from "@/lib/api/auth";
import {
  createMobileCheckout,
  getMobileCheckoutStatus,
  SITE_URL,
} from "@/lib/api/mobile";
import { Confetti } from "@/components/confetti";
import { CheckoutSkeleton } from "@/components/skeleton-loader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatAriary } from "@/lib/format";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import {
  useRewards,
  estimatePointsForPrice,
  REDEMPTION_TIERS,
} from "@/lib/rewards-provider";
import { useAuth } from "@/lib/auth-provider";
import { parsePaymentReturnUrl } from "@/lib/payment-return";
import AsyncStorage from "@react-native-async-storage/async-storage";

// WebView for checkout - loads WooCommerce pay-for-order page
let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComponent = require("react-native-webview").default;
  } catch {}
}

type CheckoutPhase =
  | "address"
  | "confirm"
  | "creating"
  | "paying"
  | "success"
  | "error"
  | "payment_error"
  | "payment_pending";

export default function CheckoutScreen() {
  const colors = useColors();
  const router = useRouter();
  const { items, clearCart, total } = useCart();
  const {
    currentTier,
    canRedeem,
    redeemPoints,
    state: rewardsState,
  } = useRewards();
  const { isAuthenticated } = useAuth();
  const rewardEligibleItems = items.filter(
    (item) => item.lamakoRewardsEnabled !== false,
  );
  const allItemsRewardEligible =
    items.length > 0 && rewardEligibleItems.length === items.length;

  // Rewards redemption state
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Calculate total points to earn for this order
  const totalPointsToEarn = rewardEligibleItems.reduce((sum, item) => {
    const price =
      typeof item.price === "string" ? parseFloat(item.price) || 0 : item.price;
    return (
      sum +
      estimatePointsForPrice(price * item.quantity, currentTier.multiplier)
    );
  }, 0);
  const webviewRef = useRef<any>(null);

  const hasPhysicalProducts = items.some((i) => !i.isEvent);
  // Show confirm phase for events-only if user can redeem points, otherwise go straight to creating
  const canShowRedeem =
    allItemsRewardEligible &&
    canRedeem &&
    rewardsState.availablePoints >= 500 &&
    isAuthenticated;
  const [phase, setPhase] = useState<CheckoutPhase>(
    hasPhysicalProducts ? "address" : canShowRedeem ? "confirm" : "creating",
  );
  const [checkoutUrl, setCheckoutUrl] = useState<string>("");
  const [orderId, setOrderId] = useState<number>(0);
  const [checkoutToken, setCheckoutToken] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string>("");
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const verificationInFlightRef = useRef(false);

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      Alert.alert(
        "Connexion requise",
        "Vous devez être connecté pour passer une commande.",
        [
          {
            text: "Se connecter",
            onPress: () =>
              router.replace({
                pathname: "/(auth)/login",
                params: { returnTo: "/checkout" },
              } as any),
          },
        ],
      );
    }
  }, [isAuthenticated]);

  // Shipping address state
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");

  // Auto-fill saved billing info
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("billing_info");
        if (saved) {
          const data = JSON.parse(saved);
          if (data.phone && !shippingPhone) setShippingPhone(data.phone);
          if (data.address && !shippingAddress)
            setShippingAddress(data.address);
          if (data.city && !shippingCity) setShippingCity(data.city);
        }
      } catch {}
    })();
  }, []);

  // Handle redeem points
  const handleRedeemPoints = async (points: number) => {
    if (!allItemsRewardEligible) {
      setRedeemError(
        "Les points LamakoRewards ne sont pas disponibles pour ce panier.",
      );
      return;
    }
    if (!rewardsState.wpUserId) {
      setRedeemError(
        "Impossible de trouver votre compte. Veuillez vous reconnecter.",
      );
      return;
    }
    setIsRedeeming(true);
    setRedeemError(null);
    try {
      const result = await redeemPoints(points, rewardsState.wpUserId);
      if (result.success && result.coupon_code) {
        setAppliedCoupon(result.coupon_code);
        setAppliedDiscount(result.discount_value || 0);
      } else {
        setRedeemError(result.error || "Erreur lors de l'échange de points.");
      }
    } catch {
      setRedeemError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsRedeeming(false);
    }
  };

  // Remove applied coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setAppliedDiscount(0);
  };

  useEffect(() => {
    if (!allItemsRewardEligible && appliedCoupon) {
      removeCoupon();
      setRedeemError(
        "La reduction LamakoRewards a ete retiree car ce panier contient un article non eligible.",
      );
    }
  }, [allItemsRewardEligible, appliedCoupon]);

  const markPaymentSuccess = (confirmedOrderId?: number) => {
    const finalOrderId = confirmedOrderId || orderId;
    if (finalOrderId) setOrderId(finalOrderId);
    setPhase("success");
    clearCart();
    notifyPaymentConfirmed(finalOrderId || orderId, formatAriary(total)).catch(
      () => {},
    );
  };

  const verifyPaymentBeforeSuccess = async () => {
    if (verificationInFlightRef.current) return;
    verificationInFlightRef.current = true;

    try {
      if (!checkoutToken) {
        setPaymentErrorMsg(
          "Session de paiement introuvable. Veuillez relancer le paiement depuis votre panier.",
        );
        setPhase("payment_error");
        return;
      }

      const status = await getMobileCheckoutStatus(checkoutToken);
      const paymentStatus = status.order.paymentStatus;

      if (paymentStatus === "success") {
        markPaymentSuccess(status.order.id);
        return;
      }

      if (paymentStatus === "pending") {
        setPaymentErrorMsg(
          "Votre paiement est en attente de confirmation. Votre commande est conservée et sera mise à jour automatiquement après validation.",
        );
        setPhase("payment_pending");
        return;
      }

      if (paymentStatus === "expired") {
        setPaymentErrorMsg(
          "Cette session de paiement a expiré. Veuillez recréer la commande depuis votre panier.",
        );
        setPhase("payment_error");
        return;
      }

      setPaymentErrorMsg(
        "Le paiement n'a pas été confirmé. Votre commande est conservée si vous souhaitez réessayer.",
      );
      setPhase("payment_error");
    } catch (err) {
      console.warn("Payment verification failed:", err);
      setPaymentErrorMsg(
        "Impossible de vérifier le statut du paiement. Veuillez consulter vos commandes ou réessayer dans quelques instants.",
      );
      setPhase("payment_error");
    } finally {
      verificationInFlightRef.current = false;
    }
  };

  const getRecoveryCheckoutUrl = () => {
    return checkoutUrl;
  };

  const openVerifiedPaymentReturn = (
    kind: string,
    token: string,
    statusHint?: string,
  ) => {
    if (kind !== "checkout" || !token) return false;
    if (checkoutToken && token !== checkoutToken) return false;

    router.replace({
      pathname: "/payment-return",
      params: {
        kind,
        token,
        status: statusHint || "",
      },
    } as any);
    return true;
  };

  const handlePaymentReturnUrl = (url: string) => {
    const parsed = parsePaymentReturnUrl(url);
    if (!parsed) return false;
    return openVerifiedPaymentReturn(
      parsed.kind,
      parsed.token,
      parsed.statusHint,
    );
  };

  // Create WC order / checkout session
  const startOrderCreation = async () => {
    try {
      if (items.length === 0) {
        setErrorMsg("Votre panier est vide");
        setPhase("error");
        return;
      }

      if (items.some((item) => item.seatLabel)) {
        setErrorMsg(
          "Les places numérotées doivent être achetées depuis le plan de salle.",
        );
        setPhase("error");
        return;
      }

      setPhase("creating");

      const storedUser = await getStoredUser();
      const billing: any = {
        first_name: storedUser?.firstName || "Client",
        last_name: storedUser?.lastName || "Mobile",
        email: storedUser?.email || "",
        phone: shippingPhone || "",
      };
      if (hasPhysicalProducts) {
        billing.address_1 = shippingAddress;
        billing.city = shippingCity;
        billing.country = "MG";
      }

      const result = await createMobileCheckout({
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          lane: item.isEvent ? "ticket" : "product",
        })),
        billing,
        shipping: hasPhysicalProducts ? billing : undefined,
        couponCode: appliedCoupon || undefined,
        source: items.every((item) => item.isEvent)
          ? "ticket"
          : items.some((item) => item.isEvent)
            ? "mixed_native_cart"
            : "product",
      });

      if (result.checkoutUrl) {
        setOrderId(result.orderId);
        setCheckoutToken(result.checkoutToken);
        setCheckoutUrl(result.checkoutUrl);
        setWebviewLoading(true);
        setRetryCount(0);
        setPhase("paying");
      } else {
        setErrorMsg(
          "Impossible de créer la session de paiement. Veuillez réessayer.",
        );
        setPhase("error");
      }
    } catch (err: any) {
      console.error("Create order error:", err);
      setErrorMsg(err?.message || "Erreur lors de la création de la commande");
      setPhase("error");
    }
  };

  // Auto-start order creation for events-only carts (only if no redeem option)
  useEffect(() => {
    if (!hasPhysicalProducts && !canShowRedeem) {
      startOrderCreation();
    }
  }, []);

  const handleNavChange = (navState: any) => {
    const url = navState.url || "";
    if (handlePaymentReturnUrl(url)) return;

    // Detect order confirmation (success)
    if (
      url.includes("order-received") ||
      url.includes("commande-recue") ||
      url.includes("thankyou")
    ) {
      verifyPaymentBeforeSuccess();
      return;
    }
    // Detect our custom checkout error param
    if (url.includes("lamako_checkout") && url.includes("error=")) {
      try {
        const urlObj = new URL(url);
        const errorParam = urlObj.searchParams.get("error") || "";
        if (errorParam) {
          setPaymentErrorMsg(decodeURIComponent(errorParam));
          setPhase("payment_error");
          return;
        }
      } catch {}
    }
    // DO NOT treat generic URLs with 'cancel'/'failed' as errors if they are payment gateway pages
    // Only treat as error if it's our own site URL with those terms
    if (
      url.startsWith(SITE_URL) &&
      (url.includes("cancel") ||
        url.includes("failed") ||
        url.includes("declined") ||
        url.includes("annule"))
    ) {
      // Ignore if it's a 404 page or the homepage (gateway return)
      if (!url.includes("404") && !url.match(/ticketbylamako\.com\/?$/)) {
        setPaymentErrorMsg("Le paiement a été annulé ou n'a pas abouti.");
        setPhase("payment_error");
        return;
      }
    }
    // If we land on a 404 page or homepage after payment gateway return, check order status
    if (url.includes("404") || url.includes("page-not-found")) {
      // This happens when Orange Money returns to a non-existent callback URL
      // Inject JS to check if order was actually paid
      const recoveryUrl = getRecoveryCheckoutUrl();
      if (webviewRef.current && recoveryUrl) {
        webviewRef.current.injectJavaScript(`
          // Redirect to our checkout page to check order status
          window.location.href = '${recoveryUrl}';
          true;
        `);
      }
      return;
    }
    // Detect if WebView navigated to homepage (session expired or gateway redirect)
    const isHomepage =
      url === SITE_URL ||
      url === SITE_URL + "/" ||
      url === SITE_URL + "/en/" ||
      url.match(/^https:\/\/www\.ticketbylamako\.com\/?$/);
    if (
      isHomepage &&
      !url.includes("lamako_checkout") &&
      !url.includes("order-received")
    ) {
      // After payment gateway, redirect back to our checkout to check status
      const recoveryUrl = getRecoveryCheckoutUrl();
      if (webviewRef.current && recoveryUrl) {
        webviewRef.current.injectJavaScript(`
          window.location.href = '${recoveryUrl}';
          true;
        `);
      }
      return;
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.source === "lamako-mobile-web") {
        if (data.version && data.version !== 1) return;
        if (data.type === "PAYMENT_RESULT" || data.type === "RETURN_TO_APP") {
          const token = data.payload?.token || checkoutToken;
          const kind = data.payload?.kind || "checkout";
          if (openVerifiedPaymentReturn(kind, token, data.payload?.status))
            return;
          verifyPaymentBeforeSuccess();
          return;
        }
        if (data.type === "ERROR") {
          setPaymentErrorMsg(data.payload?.message || "Erreur de paiement");
          setPhase("payment_error");
          return;
        }
      }

      if (data.type === "payment_success") {
        verifyPaymentBeforeSuccess();
      } else if (data.type === "payment_error") {
        setPaymentErrorMsg(data.error || data.message || "Erreur de paiement");
        setPhase("payment_error");
      } else if (data.type === "payment_cancelled") {
        setPaymentErrorMsg("Le paiement a été annulé ou n'a pas abouti.");
        setPhase("payment_error");
      } else if (data.type === "open_terms") {
        router.push("/terms" as any);
      } else if (data.type === "go_back") {
        router.back();
      }
    } catch {}
  };

  const checkoutInjectedJS = `
    (function() {
      // Inject comprehensive CSS to hide ALL non-checkout content
      var style = document.createElement('style');
      style.textContent = 
        // Hide ALL headers (mobile, desktop, sticky)
        'header, .gt-mobile-header, .gt-header, .gt-sticky-header, .site-header, #masthead,' +
        '.header-wrapper, .header-main, .header-top, .header-bottom,' +
        // Hide ALL footers
        'footer, .gt-footer, .site-footer, #colophon, .footer-wrapper, .absolute-footer,' +
        // Hide navigation, breadcrumbs, page title bar
        'nav, .navigation, .nav-links, .gt-breadcrumb, .woocommerce-breadcrumb, #wpadminbar,' +
        '.gt-page-title-bar,' +
        // Hide sidebar with widgets (latest posts, categories, etc.)
        '.gt-site-right, .sidebar, #sidebar, aside, .gt-fixed-sidebar,' +
        '.gt-general-widget, .gt-widget, .widget,' +
        // Hide chat/whatsapp/cookie widgets
        '[class*="whatsapp"], .joinchat, [id*="whatsapp"],' +
        '[class*="cookie"], [class*="consent"],' +
        '#fkcart-floating-toggler, .fkcart-main-wrapper, [class*="fkcart"],' +
        '[class*="tidio"], [id*="tidio"], [class*="chat-widget"],' +
        '[class*="crisp"], [id*="crisp"],' +
        '[class*="tawk"], [id*="tawk"],' +
        '.wc-block-mini-cart, .wp-block-woocommerce-mini-cart,' +
        '.page-title-inner, .page-title,' +
        '.comments-area, #comments,' +
        // Hide Revolution Slider
        '[class*="rev_slider"], .rs-module-wrap,' +
        // Hide mobile menu overlay
        '.gt-mobile-background, .gt-mobile-menu' +
        '{ display: none !important; }' +
        // Make checkout content full-width
        '.gt-site-left { width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important; }' +
        '.gt-page-content { padding: 0 !important; }' +
        '.gt-page-content .gt-content { padding: 10px 16px !important; }' +
        '.container { max-width: 100% !important; padding: 0 10px !important; }' +
        '.row { margin: 0 !important; }' +
        'body { background: #f8f8f8 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; margin: 0 !important; padding: 0 !important; }' +
        '.gt-site-wrapper { padding-top: 0 !important; margin-top: 0 !important; }' +
        '.gt-site-inner { padding-top: 0 !important; }' +
        // Style the WooCommerce checkout form nicely
        '.woocommerce { max-width: 100% !important; padding: 8px !important; }' +
        '#payment { border-radius: 12px !important; }' +
        '#payment .payment_methods { border-radius: 12px !important; }' +
        '#place_order { border-radius: 12px !important; font-size: 16px !important; padding: 14px !important; }' +
        // Success page styling
        '.woocommerce-order { max-width: 100% !important; padding: 20px !important; }' +
        '.woocommerce-thankyou-order-received { font-size: 18px !important; font-weight: 700 !important; color: #22c55e !important; text-align: center !important; padding: 20px 0 !important; }';
      document.head.appendChild(style);

      var url = window.location.href;
      var isOrderReceived = url.indexOf('order-received') > -1 || url.indexOf('commande-recue') > -1 || url.indexOf('thankyou') > -1;
      if (isOrderReceived) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', url: url }));
        }
        return;
      }
      if (url.indexOf('lamako_checkout') > -1 && url.indexOf('error=') > -1) {
        var params = new URLSearchParams(window.location.search);
        var errorMsg = params.get('error');
        if (errorMsg && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_error', message: errorMsg }));
        }
        return;
      }
      if ((url.indexOf('/cart') > -1 || url.indexOf('/panier') > -1) && url.indexOf('lamako_checkout') === -1 && url.indexOf('order-received') === -1) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_cancelled', message: 'Le paiement a ete annule. Votre commande est conservee.' }));
        }
        return;
      }
      function cleanup() {
        // Force-hide any elements that CSS might miss (dynamic content)
        var hideSelectors = '#wpadminbar, .qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"], [class*="tidio"], [class*="whatsapp"], [class*="tawk"], [class*="crisp"], .gt-site-right, .gt-fixed-sidebar, .gt-mobile-header, .gt-header, .gt-sticky-header, .gt-footer, .gt-page-title-bar, .gt-breadcrumb, .gt-general-widget';
        document.querySelectorAll(hideSelectors).forEach(function(el) { el.style.display = 'none'; });
        var btn = document.getElementById('place_order');
        if (btn) { btn.removeAttribute('hidden'); btn.style.display = 'block'; }
      }
      cleanup();
      setTimeout(cleanup, 300);
      setTimeout(cleanup, 800);
      setTimeout(cleanup, 1500);
      setTimeout(cleanup, 3000);
      setInterval(cleanup, 5000);
      function checkSuccess() {
        var u = window.location.href;
        if (u.indexOf('order-received') > -1 || u.indexOf('commande-recue') > -1 || u.indexOf('thankyou') > -1) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', url: u }));
          }
        }
      }
      window.addEventListener('load', checkSuccess);
      var obs = new MutationObserver(checkSuccess);
      obs.observe(document.body, { childList: true, subtree: true });
    })();
    true;
  `;

  // ---- ADDRESS phase (for physical products) ----
  if (phase === "address") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Adresse de livraison
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 4 }}>
            Veuillez renseigner votre adresse pour la livraison de vos produits.
          </Text>

          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Téléphone *
            </Text>
            <TextInput
              value={shippingPhone}
              onChangeText={setShippingPhone}
              keyboardType="phone-pad"
              placeholder="034 XX XXX XX"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Adresse *
            </Text>
            <TextInput
              value={shippingAddress}
              onChangeText={setShippingAddress}
              placeholder="Rue, numéro, quartier..."
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Ville *
            </Text>
            <TextInput
              value={shippingCity}
              onChangeText={setShippingCity}
              placeholder="Antananarivo"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholderTextColor={colors.muted}
            />
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              Récapitulatif
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
              {items.length} article{items.length > 1 ? "s" : ""} · Sous-total:{" "}
              {formatAriary(total)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Les frais d'expédition seront calculés à l'étape suivante.
            </Text>
          </View>

          {/* LamakoRewards - Points to earn + Redeem */}
          {isAuthenticated &&
            (totalPointsToEarn > 0 ||
              !allItemsRewardEligible ||
              (allItemsRewardEligible &&
                rewardsState.availablePoints >= 500)) && (
              <View
                style={{
                  backgroundColor: "#fdf6ee",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#e8d5a3",
                  padding: 12,
                  marginTop: 12,
                }}
              >
                {/* Points to earn */}
                {totalPointsToEarn > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "#f59e0b",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        ★
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#3d2314",
                        }}
                      >
                        Gagnez{" "}
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#b45309",
                          }}
                        >
                          {totalPointsToEarn} points
                        </Text>{" "}
                        LamakoRewards
                      </Text>
                      {currentTier.multiplier > 1 && (
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#92400e",
                            marginTop: 2,
                          }}
                        >
                          Bonus {currentTier.name} : x{currentTier.multiplier}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Redeem section */}
                {allItemsRewardEligible &&
                  canRedeem &&
                  rewardsState.availablePoints >= 500 &&
                  !appliedCoupon && (
                    <View
                      style={{
                        borderTopWidth: totalPointsToEarn > 0 ? 1 : 0,
                        borderTopColor: "#e8d5a3",
                        marginTop: totalPointsToEarn > 0 ? 10 : 0,
                        paddingTop: totalPointsToEarn > 0 ? 10 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#3d2314",
                          marginBottom: 8,
                        }}
                      >
                        Utiliser mes points ({rewardsState.availablePoints} pts)
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {REDEMPTION_TIERS.filter(
                          (t) => t.points <= rewardsState.availablePoints,
                        ).map((tier) => (
                          <TouchableOpacity
                            key={tier.points}
                            onPress={() => handleRedeemPoints(tier.points)}
                            disabled={isRedeeming}
                            style={{
                              backgroundColor: "#b45309",
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              opacity: isRedeeming ? 0.5 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              -{formatAriary(tier.value)}
                            </Text>
                            <Text style={{ color: "#fde68a", fontSize: 10 }}>
                              {tier.points} pts
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {isRedeeming && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 8,
                          }}
                        >
                          <ActivityIndicator size="small" color="#b45309" />
                          <Text style={{ fontSize: 12, color: "#92400e" }}>
                            Échange en cours...
                          </Text>
                        </View>
                      )}
                      {redeemError && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            marginTop: 6,
                          }}
                        >
                          {redeemError}
                        </Text>
                      )}
                    </View>
                  )}

                {!allItemsRewardEligible && (
                  <View
                    style={{
                      borderTopWidth: totalPointsToEarn > 0 ? 1 : 0,
                      borderTopColor: "#e8d5a3",
                      marginTop: totalPointsToEarn > 0 ? 10 : 0,
                      paddingTop: totalPointsToEarn > 0 ? 10 : 0,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: "#92400e" }}>
                      Les points LamakoRewards ne sont pas disponibles sur tous
                      les articles de ce panier.
                    </Text>
                  </View>
                )}

                {/* Applied coupon */}
                {appliedCoupon && (
                  <View
                    style={{
                      borderTopWidth: totalPointsToEarn > 0 ? 1 : 0,
                      borderTopColor: "#e8d5a3",
                      marginTop: totalPointsToEarn > 0 ? 10 : 0,
                      paddingTop: totalPointsToEarn > 0 ? 10 : 0,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#15803d",
                          }}
                        >
                          ✓ Réduction appliquée : -
                          {formatAriary(appliedDiscount)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#92400e",
                            marginTop: 2,
                          }}
                        >
                          Coupon : {appliedCoupon}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={removeCoupon}
                        style={{ padding: 6 }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            fontWeight: "600",
                          }}
                        >
                          Retirer
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Not eligible message */}
                {allItemsRewardEligible &&
                  !canRedeem &&
                  rewardsState.availablePoints > 0 && (
                    <View
                      style={{
                        borderTopWidth: totalPointsToEarn > 0 ? 1 : 0,
                        borderTopColor: "#e8d5a3",
                        marginTop: totalPointsToEarn > 0 ? 10 : 0,
                        paddingTop: totalPointsToEarn > 0 ? 10 : 0,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: "#92400e" }}>
                        Encore {750 - rewardsState.lifetimePoints} pts à
                        accumuler pour débloquer l'échange
                      </Text>
                    </View>
                  )}
              </View>
            )}

          <TouchableOpacity
            onPress={() => {
              if (
                !shippingAddress.trim() ||
                !shippingCity.trim() ||
                !shippingPhone.trim()
              ) {
                Alert.alert(
                  "Champs requis",
                  "Veuillez remplir tous les champs obligatoires.",
                );
                return;
              }
              startOrderCreation();
            }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              Continuer vers le paiement
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---- CONFIRM phase (events-only with redeem option) ----
  if (phase === "confirm") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Confirmation
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Order summary */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              R\u00e9capitulatif
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
              {items.length} article{items.length > 1 ? "s" : ""} \u00b7 Total:{" "}
              {formatAriary(total)}
            </Text>
            {appliedCoupon && (
              <Text
                style={{
                  color: "#15803d",
                  fontSize: 13,
                  fontWeight: "600",
                  marginTop: 4,
                }}
              >
                R\u00e9duction : -{formatAriary(appliedDiscount)}
              </Text>
            )}
          </View>

          {/* Redeem section */}
          <View
            style={{
              backgroundColor: "#fdf6ee",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e8d5a3",
              padding: 12,
            }}
          >
            {/* Points to earn */}
            {totalPointsToEarn > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "#f59e0b",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}
                  >
                    \u2605
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "#3d2314",
                    }}
                  >
                    Gagnez{" "}
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#b45309",
                      }}
                    >
                      {totalPointsToEarn} points
                    </Text>{" "}
                    LamakoRewards
                  </Text>
                </View>
              </View>
            )}

            {/* Redeem buttons */}
            {!appliedCoupon && (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#3d2314",
                    marginBottom: 8,
                  }}
                >
                  Utiliser mes points ({rewardsState.availablePoints} pts)
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {REDEMPTION_TIERS.filter(
                    (t) => t.points <= rewardsState.availablePoints,
                  ).map((tier) => (
                    <TouchableOpacity
                      key={tier.points}
                      onPress={() => handleRedeemPoints(tier.points)}
                      disabled={isRedeeming}
                      style={{
                        backgroundColor: "#b45309",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        opacity: isRedeeming ? 0.5 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        -{formatAriary(tier.value)}
                      </Text>
                      <Text style={{ color: "#fde68a", fontSize: 10 }}>
                        {tier.points} pts
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isRedeeming && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color="#b45309" />
                    <Text style={{ fontSize: 12, color: "#92400e" }}>
                      \u00c9change en cours...
                    </Text>
                  </View>
                )}
                {redeemError && (
                  <Text
                    style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}
                  >
                    {redeemError}
                  </Text>
                )}
              </View>
            )}

            {/* Applied coupon */}
            {appliedCoupon && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#15803d",
                    }}
                  >
                    \u2713 R\u00e9duction appliqu\u00e9e : -
                    {formatAriary(appliedDiscount)}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}
                  >
                    Coupon : {appliedCoupon}
                  </Text>
                </View>
                <TouchableOpacity onPress={removeCoupon} style={{ padding: 6 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#dc2626",
                      fontWeight: "600",
                    }}
                  >
                    Retirer
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Continue button */}
          <TouchableOpacity
            onPress={() => {
              setPhase("creating");
              startOrderCreation();
            }}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {appliedCoupon
                ? `Payer ${formatAriary(Math.max(0, total - appliedDiscount))}`
                : "Continuer vers le paiement"}
            </Text>
          </TouchableOpacity>

          {/* Skip redeem */}
          {!appliedCoupon && (
            <TouchableOpacity
              onPress={() => {
                setPhase("creating");
                startOrderCreation();
              }}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Passer sans utiliser mes points
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---- CREATING phase ----
  if (phase === "creating") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Préparation...
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            Création de votre commande...
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.muted }]}>
            {items.length} article{items.length > 1 ? "s" : ""} ·{" "}
            {formatAriary(total)}
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Erreur
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol name="xmark.circle.fill" size={56} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Impossible de procéder au paiement
          </Text>
          <Text style={[styles.errorMsg, { color: colors.muted }]}>
            {errorMsg}
          </Text>
          <TouchableOpacity
            onPress={() => startOrderCreation()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.muted }]}>
              Retour au panier
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- PAYMENT ERROR phase ----
  if (phase === "payment_error") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Paiement échoué
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={56}
            color={colors.warning}
          />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Paiement non abouti
          </Text>
          <Text style={[styles.errorMsg, { color: colors.muted }]}>
            {paymentErrorMsg}
          </Text>
          <Text style={[styles.errorHint, { color: colors.muted }]}>
            Votre commande est conservée. Vous pouvez réessayer avec un autre
            mode de paiement.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPaymentErrorMsg("");
              setPhase("paying");
              setWebviewLoading(true);
              const baseUrl = checkoutUrl.split("&error=")[0];
              setCheckoutUrl(baseUrl);
            }}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>
              Essayer un autre mode de paiement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              clearCart();
              router.back();
            }}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.muted }]}>
              Abandonner et vider le panier
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- PAYMENT PENDING phase ----
  if (phase === "payment_pending") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Paiement en attente
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol name="clock.fill" size={56} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Confirmation en cours
          </Text>
          <Text style={[styles.errorMsg, { color: colors.muted }]}>
            {paymentErrorMsg}
          </Text>
          <TouchableOpacity
            onPress={() => verifyPaymentBeforeSuccess()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Vérifier maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace("/orders" as any)}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.primary }]}>
              Voir mes commandes
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- SUCCESS phase ----
  if (phase === "success") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Confetti active={true} />
        <View style={styles.centerContent}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.success + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={56}
              color={colors.success}
            />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Paiement réussi !
          </Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>
            Votre commande #{orderId} a été confirmée.{"\n"}Vous recevrez un
            email de confirmation.
          </Text>
          {total > 0 && (
            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: colors.primary,
                marginTop: 8,
              }}
            >
              {formatAriary(total)}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/" as any)}
            style={[
              styles.retryBtn,
              { backgroundColor: colors.primary, marginTop: 24 },
            ]}
          >
            <Text style={styles.retryBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace("/orders" as any)}
            style={[styles.backLink, { marginTop: 12 }]}
          >
            <Text style={[styles.backLinkText, { color: colors.primary }]}>
              Voir mes commandes
            </Text>
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <IconSymbol
              name="chevron.left"
              size={24}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Paiement sécurisé
          </Text>
          <IconSymbol name="lock.fill" size={16} color={colors.success} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol name="lock.fill" size={48} color={colors.primary} />
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Paiement sécurisé
          </Text>
          <Text style={[styles.successSub, { color: colors.muted }]}>
            Commande #{orderId} · {formatAriary(total)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (typeof window !== "undefined")
                window.open(checkoutUrl, "_blank");
            }}
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
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Annuler le paiement ?",
              "Votre commande sera conservée. Vous pourrez la payer plus tard.",
              [
                { text: "Continuer le paiement", style: "cancel" },
                {
                  text: "Quitter",
                  style: "destructive",
                  onPress: () => router.back(),
                },
              ],
            );
          }}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <IconSymbol name="lock.fill" size={14} color={colors.success} />
          <Text
            style={[
              styles.headerTitle,
              { color: colors.foreground, marginLeft: 6 },
            ]}
          >
            Paiement sécurisé
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      {webviewLoading && (
        <View
          style={[styles.webviewLoader, { backgroundColor: colors.background }]}
        >
          <CheckoutSkeleton />
        </View>
      )}
      <WebViewComponent
        ref={webviewRef}
        source={{ uri: checkoutUrl }}
        onLoadEnd={() => setWebviewLoading(false)}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={(request: any) => {
          const url = request.url || "";
          if (handlePaymentReturnUrl(url)) return false;
          if (url.startsWith("ticketbylamako://")) return false;
          if (url.startsWith(SITE_URL)) return true;
          if (
            url.includes("mvola") ||
            url.includes("orange") ||
            url.includes("airtel")
          )
            return true;
          if (
            url.includes("cybersource") ||
            url.includes("visa") ||
            url.includes("mastercard")
          )
            return true;
          if (url.includes("paypal") || url.includes("stripe")) return true;
          if (url.startsWith("https://")) return true;
          return false;
        }}
        onError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          const errorCode = nativeEvent?.code || 0;
          const errorDescription = nativeEvent?.description || "";
          // NSURL error -1005 = network connection lost - auto retry
          if (
            errorCode === -1005 ||
            errorDescription.includes("-1005") ||
            errorDescription.includes("connection was lost")
          ) {
            if (retryCount < MAX_RETRIES) {
              setRetryCount((prev) => prev + 1);
              // Auto-retry after 2 seconds
              setTimeout(() => {
                if (webviewRef.current) {
                  webviewRef.current.reload();
                }
              }, 2000);
              return;
            }
          }
          // For MVola timeouts - wait longer before declaring failure (45s)
          if (
            checkoutUrl.includes("mvola") ||
            errorDescription.includes("timeout")
          ) {
            if (retryCount < MAX_RETRIES) {
              setRetryCount((prev) => prev + 1);
              setTimeout(() => {
                if (webviewRef.current) {
                  webviewRef.current.reload();
                }
              }, 3000);
              return;
            }
          }
          // Only show error after retries exhausted
          setPaymentErrorMsg(
            `Erreur réseau (${errorCode}): ${errorDescription}. Veuillez vérifier votre connexion et réessayer.`,
          );
          setPhase("payment_error");
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  backBtn: { width: 40, alignItems: "flex-start" },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 17, fontWeight: "600", marginTop: 20 },
  loadingSubtext: { fontSize: 14, marginTop: 6 },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  errorMsg: { fontSize: 14, marginTop: 8, textAlign: "center" },
  errorHint: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 14 },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  webviewLoader: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
});

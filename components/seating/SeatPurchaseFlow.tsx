import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Confetti } from "@/components/confetti";
import { SeatingChartSkeleton } from "@/components/skeleton-loader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { parsePaymentReturnUrl } from "@/lib/payment-return";
import {
  createMobileSeatingSession,
  getMobileSeatingSessionStatus,
  SITE_URL,
  type CreateMobileSeatingSessionResponse,
} from "@/lib/api/mobile";

let WebViewComponent: any = null;
if (Platform.OS !== "web") {
  try {
    WebViewComponent = require("react-native-webview").default;
  } catch {}
}

type FlowPhase = "loading" | "seating" | "checkout" | "pending" | "success" | "error";

interface WebMessageEnvelope {
  source?: string;
  version?: number;
  flowId?: string;
  type?: string;
  payload?: Record<string, any>;
}

interface SelectedSeat {
  id?: string;
  label?: string;
}

interface SeatPurchaseFlowProps {
  eventId: number;
  eventTitle: string;
  onClose: () => void;
}

export function SeatPurchaseFlow({ eventId, eventTitle, onClose }: SeatPurchaseFlowProps) {
  const colors = useColors();
  const router = useRouter();
  const { clearCart } = useCart();
  const webviewRef = useRef<any>(null);
  const verifyingRef = useRef(false);
  const closingCheckoutRef = useRef(false);
  const [session, setSession] = useState<CreateMobileSeatingSessionResponse | null>(null);
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [error, setError] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [showSeatSummary, setShowSeatSummary] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError("");

    createMobileSeatingSession({ eventId })
      .then(result => {
        if (cancelled) return;
        setSession(result);
        setPhase("seating");
      })
      .catch(err => {
        if (cancelled) return;
        console.warn("Create seating session failed:", err);
        setError(err?.message || "Impossible de créer la session de réservation.");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const verifyPayment = async () => {
    if (!session?.flowToken || verifyingRef.current) return;
    verifyingRef.current = true;

    try {
      const status = await getMobileSeatingSessionStatus(session.flowToken);
      const paymentStatus = status.order?.paymentStatus || status.status;

      if (paymentStatus === "success") {
        setOrderId(status.order?.id || null);
        clearCart();
        setPhase("success");
        return;
      }

      if (paymentStatus === "pending" || paymentStatus === "active") {
        setOrderId(status.order?.id || null);
        setPhase("pending");
        return;
      }

      setError("Le paiement n'a pas été confirmé. Votre commande est conservée si elle a été créée.");
      setPhase("error");
    } catch (err: any) {
      console.warn("Seating payment verification failed:", err);
      setError("Impossible de vérifier le statut du paiement. Consultez vos commandes dans quelques instants.");
      setPhase("error");
    } finally {
      verifyingRef.current = false;
    }
  };

  const openVerifiedPaymentReturn = (kind: string, token: string, statusHint?: string) => {
    if (kind !== "seating" || !token) return false;
    if (session?.flowToken && token !== session.flowToken) return false;

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
    return openVerifiedPaymentReturn(parsed.kind, parsed.token, parsed.statusHint);
  };

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as WebMessageEnvelope;
      if (message.source && message.source !== "lamako-mobile-web") return;
      if (message.version && message.version !== 1) return;
      if (session?.flowId && message.flowId && message.flowId !== session.flowId) return;

      switch (message.type) {
        case "FLOW_READY":
          setPhase("seating");
          break;
        case "SEAT_SELECTION_CHANGED":
          setSelectedCount(Number(message.payload?.count || 0));
          setSelectedSeats(Array.isArray(message.payload?.seats) ? message.payload.seats : []);
          break;
        case "CHECKOUT_READY":
        case "PAYMENT_STARTED":
          setPhase("checkout");
          break;
        case "PAYMENT_RESULT":
        case "RETURN_TO_APP":
          if (
            openVerifiedPaymentReturn(
              message.payload?.kind || "seating",
              message.payload?.token || session?.flowToken || "",
              message.payload?.status
            )
          ) {
            return;
          }
          verifyPayment();
          break;
        case "SESSION_EXPIRED":
          setError("Cette session de réservation a expiré.");
          setPhase("error");
          break;
        case "ERROR":
          setError(message.payload?.message || "Une erreur est survenue.");
          setPhase("error");
          break;
        case "CANCEL_REQUESTED":
          closingCheckoutRef.current = false;
          onClose();
          break;
      }
    } catch {
      // Ignore non-Lamako messages from payment providers.
    }
  };

  const handleNavChange = (navState: any) => {
    const url = navState.url || "";
    if (handlePaymentReturnUrl(url)) return;

    if (url.includes("/checkout") || url.includes("/commande") || url.includes("order-pay")) {
      setPhase("checkout");
    }
    if (url.includes("order-received") || url.includes("commande-recue") || url.includes("thankyou")) {
      verifyPayment();
    }
  };

  const injectedJavaScript = `
    (function() {
      if (window.__LAMAKO_MOBILE_WEBVIEW_INJECTED__) return true;
      window.__LAMAKO_MOBILE_WEBVIEW_INJECTED__ = true;
      var style = document.createElement('style');
      style.textContent =
        '#wpadminbar, header, footer, nav, aside, .site-header, .site-footer, #masthead, #colophon, .woocommerce-breadcrumb, .gt-breadcrumb, .gt-page-title-bar, .sidebar,' +
        '[class*="whatsapp"], [id*="whatsapp"], [class*="qlwapp"], [id*="qlwapp"], [class*="cookie"], [class*="consent"], #fkcart-floating-toggler, .fkcart-main-wrapper,' +
        '[class*="tidio"], [id*="tidio"], [class*="tawk"], [id*="tawk"], [class*="crisp"], [id*="crisp"] { display: none !important; visibility: hidden !important; }' +
        'body { margin: 0 !important; padding: 0 !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important; background: #f7f3ed !important; }' +
        '.woocommerce, .woocommerce-cart, .woocommerce-checkout { max-width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }' +
        '.wc-proceed-to-checkout a, .checkout-button, #place_order { display: block !important; width: 100% !important; border-radius: 12px !important; padding: 14px !important; font-size: 16px !important; font-weight: 800 !important; }';
      document.head.appendChild(style);
      function post(type, payload) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          source: 'lamako-mobile-web',
          version: 1,
          flowId: '${session?.flowId || ""}',
          type: type,
          payload: payload || {},
          ts: Date.now(),
          signature: ''
        }));
      }
      var url = window.location.href;
      if (url.indexOf('/checkout') !== -1 || url.indexOf('/commande') !== -1 || url.indexOf('order-pay') !== -1) post('CHECKOUT_READY', { url: url });
      if (url.indexOf('order-received') !== -1 || url.indexOf('commande-recue') !== -1 || url.indexOf('thankyou') !== -1) post('PAYMENT_RESULT', { status: 'success', url: url });
      true;
    })();
  `;

  const handleClose = () => {
    if (phase === "checkout" && !closingCheckoutRef.current) {
      closingCheckoutRef.current = true;
      webviewRef.current?.injectJavaScript(`
        if (window.lamakoMobileBack) {
          window.lamakoMobileBack();
        }
        true;
      `);
      setTimeout(() => {
        if (closingCheckoutRef.current) {
          closingCheckoutRef.current = false;
          onClose();
        }
      }, 1200);
      return;
    }
    onClose();
  };

  const title = phase === "checkout" ? "Paiement sécurisé" : phase === "success" ? "Confirmation" : "Plan de salle";
  const visibleSelectedCount = phase === "seating" ? selectedCount : 0;

  const continueToCheckoutFromSummary = () => {
    setShowSeatSummary(false);
    webviewRef.current?.injectJavaScript(`
      if (window.lamakoGoToCheckoutFromApp) {
        window.lamakoGoToCheckoutFromApp();
      }
      true;
    `);
  };

  const seatsForModal: SelectedSeat[] =
    selectedSeats.length > 0 ? selectedSeats : Array.from({ length: selectedCount }, (_, index) => ({ label: `Place ${index + 1}` }));

  const seatSummaryModal = (
    <Modal visible={showSeatSummary} transparent animationType="fade" onRequestClose={() => setShowSeatSummary(false)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.seatModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.seatModalHeader}>
            <Text style={[styles.seatModalTitle, { color: colors.foreground }]}>Places sélectionnées</Text>
            <TouchableOpacity onPress={() => setShowSeatSummary(false)} style={styles.modalClose}>
              <IconSymbol name="xmark" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.seatList}>
            {seatsForModal.map((seat, index) => (
              <View key={`${seat?.id || "seat"}-${index}`} style={[styles.seatChip, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                <IconSymbol name="mappin" size={14} color={colors.primary} />
                <Text style={[styles.seatChipText, { color: colors.primary }]}>{seat?.label || `Place ${index + 1}`}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={continueToCheckoutFromSummary} style={[styles.modalPayButton, { backgroundColor: colors.success || "#16a34a" }]}>
            <Text style={styles.modalPayButtonText}>Continuer vers le paiement</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (phase === "loading") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title="Plan de salle" colors={colors} onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.muted }]}>Préparation du plan de salle pour {eventTitle}...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "error") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title="Plan de salle" colors={colors} onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Réservation indisponible</Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>{error}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>Retour à l'événement</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "pending") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title="Paiement en attente" colors={colors} onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <IconSymbol name="clock.fill" size={48} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Confirmation en cours</Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>Votre paiement est en cours de vérification.</Text>
          <TouchableOpacity onPress={verifyPayment} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>Vérifier maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/orders" as any)} style={styles.secondaryButton}>
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Voir mes commandes</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "success") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title="Confirmation" colors={colors} onClose={handleClose} />
        {seatSummaryModal}
        <Confetti active />
        <View style={styles.center}>
          <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Paiement confirmé</Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>
            {orderId ? `Votre commande #${orderId} est confirmée.` : "Votre commande est confirmée."}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/orders" as any)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>Voir mes commandes</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (Platform.OS === "web" || !WebViewComponent) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <Header title={title} colors={colors} onClose={handleClose} selectedCount={visibleSelectedCount} onSeatSummary={() => setShowSeatSummary(true)} />
        {seatSummaryModal}
        <View style={styles.center}>
          <Text style={[styles.centerText, { color: colors.muted }]}>Le plan de salle est disponible dans l'application mobile.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Header title={title} colors={colors} onClose={handleClose} selectedCount={visibleSelectedCount} onSeatSummary={() => setShowSeatSummary(true)} />
      {seatSummaryModal}
      <WebViewComponent
        ref={webviewRef}
        source={{ uri: session!.seatUrl }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavChange}
        renderLoading={() => (
          <View style={styles.loader}>
            <SeatingChartSkeleton />
          </View>
        )}
        onShouldStartLoadWithRequest={(request: any) => {
          const url = request.url || "";
          if (handlePaymentReturnUrl(url)) return false;
          if (url.startsWith("ticketbylamako://")) return false;
          if (url.startsWith(SITE_URL)) return true;
          if (url.startsWith("https://")) return true;
          if (url.startsWith("about:") || url.startsWith("data:")) return true;
          return false;
        }}
        onError={(event: any) => {
          const description = event?.nativeEvent?.description || "Erreur WebView";
          Alert.alert("Erreur", description);
        }}
      />
    </ScreenContainer>
  );
}

function Header({ title, colors, onClose, selectedCount = 0, onSeatSummary }: { title: string; colors: any; onClose: () => void; selectedCount?: number; onSeatSummary?: () => void }) {
  const showSeatBadge = selectedCount > 0 && !!onSeatSummary;

  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={onClose} style={styles.headerBack}>
        <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        <Text style={[styles.headerBackText, { color: colors.foreground }]}>Retour</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
      {showSeatBadge ? (
        <TouchableOpacity onPress={onSeatSummary} style={[styles.badge, styles.headerBadge, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
          <Text style={styles.badgeText}>{selectedCount}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 52, borderBottomWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", position: "relative" },
  headerBack: { position: "absolute", left: 12, width: 86, flexDirection: "row", alignItems: "center", zIndex: 2 },
  headerBackText: { fontSize: 14, fontWeight: "600" },
  headerTitle: { width: "100%", textAlign: "center", fontSize: 16, fontWeight: "800", paddingHorizontal: 96 },
  headerBadge: { position: "absolute", right: 12, zIndex: 2 },
  badge: { minWidth: 32, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  centerText: { marginTop: 12, fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorTitle: { marginTop: 14, fontSize: 18, fontWeight: "800", textAlign: "center" },
  successTitle: { marginTop: 14, fontSize: 20, fontWeight: "800", textAlign: "center" },
  primaryButton: { marginTop: 22, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButton: { marginTop: 12, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
  loader: { position: "absolute", top: 52, left: 0, right: 0, bottom: 0 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center", padding: 20 },
  seatModal: { borderWidth: 1, borderRadius: 14, padding: 16 },
  seatModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  seatModalTitle: { fontSize: 17, fontWeight: "800" },
  modalClose: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  seatList: { gap: 8, marginBottom: 16 },
  seatChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  seatChipText: { fontSize: 14, fontWeight: "800" },
  modalPayButton: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  modalPayButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});

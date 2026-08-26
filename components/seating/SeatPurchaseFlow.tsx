import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Confetti } from "@/components/confetti";
import {
  SeatFlowHeader,
  SeatSummaryModal,
} from "@/components/seating/SeatFlowChrome";
import { seatPurchaseFlowStyles as styles } from "@/components/seating/seat-purchase-flow.styles";
import { SeatingChartSkeleton } from "@/components/skeleton-loader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { isAllowedWebViewUrl } from "@/lib/webview-policy";
import {
  isSeatingCheckoutUrl,
  isSeatingSessionUrl,
  isSeatingSuccessUrl,
  parseSeatingWebMessage,
  type SelectedSeat,
} from "@/lib/seating-webview";
import {
  normalizeSeatLabels,
  seatingOrderId,
  seatingSelectionSnapshot,
} from "@/lib/seating-bridge";
import {
  createMobileSeatingSession,
  getMobileSeatingSessionStatus,
  type CreateMobileSeatingSessionResponse,
} from "@/lib/api/mobile";
import SeatingBrowserFrame from "@/components/seating/seating-browser-frame";

const WebViewComponent: any = SeatingBrowserFrame;

type FlowPhase =
  | "loading"
  | "seating"
  | "checkout"
  | "pending"
  | "success"
  | "error";

interface SeatPurchaseFlowProps {
  eventId: number;
  eventTitle: string;
  onClose: () => void;
}

export function SeatPurchaseFlow({
  eventId,
  eventTitle,
  onClose,
}: SeatPurchaseFlowProps) {
  const colors = useColors();
  const router = useRouter();
  const { clearCart } = useCart();
  const webviewRef = useRef<any>(null);
  const verifyingRef = useRef(false);
  const closingCheckoutRef = useRef(false);
  const sessionRecoveryRef = useRef(0);
  const orderTransitionRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSession] =
    useState<CreateMobileSeatingSessionResponse | null>(null);
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [error, setError] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);
  const [inCartCount, setInCartCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("Sélectionnez une ou plusieurs places");
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [showSeatSummary, setShowSeatSummary] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError("");

    createMobileSeatingSession({ eventId })
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        setPhase("seating");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Create seating session failed:", err);
        setError(
          err?.message || "Impossible de créer la session de réservation.",
        );
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, sessionAttempt]);

  useEffect(
    () => () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    },
    [],
  );

  const restartSeatingSession = (resetRecovery = false) => {
    if (resetRecovery) sessionRecoveryRef.current = 0;
    setSession(null);
    setSelectedCount(0);
    setInCartCount(0);
    setPendingCount(0);
    setSeatDialogOpen(false);
    setBridgeReady(false);
    setChecking(false);
    setStatus("Sélectionnez une ou plusieurs places");
    setSelectedSeats([]);
    setError("");
    orderTransitionRef.current = false;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
    setPhase("loading");
    setSessionAttempt((attempt) => attempt + 1);
  };

  const openPaymentForOrder = useCallback(
    (flowToken: string, createdOrderId?: number | null) => {
      if (!flowToken || orderTransitionRef.current) return false;
      orderTransitionRef.current = true;
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      if (createdOrderId) setOrderId(createdOrderId);
      setChecking(false);
      setPhase("checkout");
      onClose();
      setTimeout(() => {
        router.push({
          pathname: "/payment",
          params: { kind: "seating", token: flowToken },
        } as any);
      }, 0);
      return true;
    },
    [onClose, router],
  );

  const refreshSeatingOrder = useCallback(
    async (attempts = 1, intervalMs = 600) => {
      if (!session?.flowToken || orderTransitionRef.current) return false;
      setChecking(true);
      try {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const response = await getMobileSeatingSessionStatus(
            session.flowToken,
          );
          if (response.order?.id) {
            return openPaymentForOrder(session.flowToken, response.order.id);
          }
          if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        }
        if (attempts > 1) {
          setStatus("Confirmation en cours. Actualisez si nécessaire.");
        }
      } catch (err: any) {
        console.warn("Seating order verification failed:", err);
        if (attempts <= 1) {
          Alert.alert(
            "Plan de salle",
            err?.message || "Le statut des sièges est indisponible.",
          );
        }
      } finally {
        if (!orderTransitionRef.current) setChecking(false);
      }
      return false;
    },
    [openPaymentForOrder, session?.flowToken],
  );

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

      setError(
        "Le paiement n'a pas été confirmé. Votre commande est conservée si elle a été créée.",
      );
      setPhase("error");
    } catch (err: any) {
      console.warn("Seating payment verification failed:", err);
      setError(
        "Impossible de vérifier le statut du paiement. Consultez vos commandes dans quelques instants.",
      );
      setPhase("error");
    } finally {
      verifyingRef.current = false;
    }
  };

  const handleMessage = (event: any) => {
    const message = parseSeatingWebMessage(
      String(event.nativeEvent.data || ""),
      session?.flowId,
    );
    if (!message) return;

    try {
      switch (message.type) {
        case "FLOW_READY":
          setBridgeReady(true);
          setStatus("Sélectionnez une ou plusieurs places");
          setPhase("seating");
          break;
        case "SEATING_CHART_OPENED":
          setPhase("seating");
          break;
        case "SEAT_SELECTION_CHANGED":
          {
            const selection = seatingSelectionSnapshot(message.payload);
            setSelectedCount(selection.selectedCount);
            setInCartCount(selection.inCartCount);
            setPendingCount(selection.pendingCount);
            const seats = Array.isArray(message.payload?.seats)
              ? (message.payload.seats as SelectedSeat[])
              : selection.seatLabels.map((label) => ({ label }));
            setSelectedSeats(seats);
            setStatus(
              selection.pendingCount
                ? "Ajoutez la place sélectionnée au panier"
                : selection.inCartCount
                  ? "Sélection prête à confirmer"
                  : "Sélectionnez une ou plusieurs places",
            );
          }
          break;
        case "SEATING_MODAL_STATE":
          setSeatDialogOpen(Boolean(message.payload?.dialogOpen));
          if (message.payload?.dialogOpen) {
            setChecking(false);
            setStatus("Validez l'ajout dans la fenêtre du siège");
          }
          break;
        case "SEATING_CART_ADDING":
          setChecking(true);
          setStatus("Ajout de la place au panier...");
          break;
        case "SEATING_CART_REMOVING":
          setChecking(true);
          setStatus("Retrait de la place du panier...");
          break;
        case "SEATING_CART_UPDATED":
          setChecking(false);
          setStatus(
            message.payload?.action === "removed"
              ? "Place retirée. Vous pouvez poursuivre la sélection."
              : "Place ajoutée. Ajoutez-en une autre ou confirmez.",
          );
          {
            const labels = normalizeSeatLabels(message.payload?.seatLabels);
            if (labels.length)
              setSelectedSeats(labels.map((label) => ({ label })));
            const cartCount = Number(message.payload?.inCartCount || 0);
            if (cartCount >= 0) setInCartCount(cartCount);
          }
          break;
        case "SEATING_ORDER_CREATING":
          setChecking(true);
          setStatus("Préparation de la commande...");
          break;
        case "CHECKOUT_READY":
          setPhase("checkout");
          break;
        case "SEATING_ORDER_CREATED": {
          const flowToken = String(
            message.payload?.token || session?.flowToken || "",
          );
          const orderPayload = message.payload?.order;
          const createdOrderId = seatingOrderId(orderPayload);
          if (!flowToken) {
            setError(
              "La commande a été créée sans session de paiement valide.",
            );
            setPhase("error");
            break;
          }
          if (createdOrderId) setOrderId(createdOrderId);
          setStatus("Sièges confirmés");
          setChecking(true);
          // The server status is the source of truth. It also protects the
          // native flow from racing Tickera's final order persistence.
          void refreshSeatingOrder(4, 350);
          break;
        }
        case "PAYMENT_STARTED":
          setPhase("checkout");
          break;
        case "PAYMENT_RESULT":
        case "RETURN_TO_APP":
          verifyPayment();
          break;
        case "SESSION_EXPIRED":
          setError("Cette session de réservation a expiré.");
          setPhase("error");
          break;
        case "ERROR":
        case "SEATING_ORDER_ERROR":
        case "SEATING_CART_ADD_ERROR":
          setChecking(false);
          setError(
            String(message.payload?.message || "Une erreur est survenue."),
          );
          setPhase("error");
          break;
        case "SEATING_CART_REQUIRED":
          setChecking(false);
          setStatus("Ajoutez chaque place au panier dans le plan");
          Alert.alert(
            "Place non confirmée",
            String(
              message.payload?.message ||
                "Ajoutez d'abord la place au panier dans la fenêtre du siège.",
            ),
          );
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
    const url = String(navState.url || "");
    if (isSeatingCheckoutUrl(url)) setPhase("checkout");
    if (isSeatingSuccessUrl(url)) verifyPayment();
  };

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

  const title =
    phase === "checkout"
      ? "Paiement sécurisé"
      : phase === "success"
        ? "Confirmation"
        : "Plan de salle";
  const visibleSelectedCount = phase === "seating" ? inCartCount : 0;

  const continueToCheckoutFromSummary = () => {
    setShowSeatSummary(false);
    webviewRef.current?.injectJavaScript(`
      if (window.lamakoPrimarySeatActionFromApp) {
        window.lamakoPrimarySeatActionFromApp();
      } else if (window.lamakoGoToCheckoutFromApp) {
        window.lamakoGoToCheckoutFromApp();
      }
      true;
    `);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(
      () => void refreshSeatingOrder(8, 600),
      2000,
    );
  };

  const continueToCheckout = () => {
    if (seatDialogOpen || pendingCount > 0) {
      Alert.alert(
        "Validez la place",
        "Utilisez d'abord le bouton Ajouter au panier dans la fenêtre du siège.",
      );
      return;
    }
    if (!inCartCount) {
      Alert.alert(
        "Aucune place confirmée",
        "Sélectionnez une place puis ajoutez-la au panier dans le plan.",
      );
      return;
    }
    if (!bridgeReady || checking) return;
    setChecking(true);
    setStatus("Confirmation des places...");
    webviewRef.current?.injectJavaScript(`
      if (window.lamakoPrimarySeatActionFromApp) {
        window.lamakoPrimarySeatActionFromApp();
      } else if (window.lamakoGoToCheckoutFromApp) {
        window.lamakoGoToCheckoutFromApp();
      }
      true;
    `);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(
      () => void refreshSeatingOrder(8, 600),
      2000,
    );
  };

  const seatsForModal: SelectedSeat[] =
    selectedSeats.length > 0
      ? selectedSeats
      : Array.from({ length: selectedCount }, (_, index) => ({
          label: `Place ${index + 1}`,
        }));

  const seatSummaryModal = (
    <SeatSummaryModal
      visible={showSeatSummary}
      seats={seatsForModal}
      onClose={() => setShowSeatSummary(false)}
      onContinue={continueToCheckoutFromSummary}
    />
  );

  if (phase === "loading") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <SeatFlowHeader title="Plan de salle" onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.muted }]}>
            Préparation du plan de salle pour {eventTitle}...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "error") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <SeatFlowHeader title="Plan de salle" onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={48}
            color={colors.warning}
          />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Réservation indisponible
          </Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => restartSeatingSession(true)}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.secondaryButton}>
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              Retour à l'événement
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "pending") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <SeatFlowHeader title="Paiement en attente" onClose={handleClose} />
        {seatSummaryModal}
        <View style={styles.center}>
          <IconSymbol name="clock.fill" size={48} color={colors.warning} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Confirmation en cours
          </Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>
            Votre paiement est en cours de vérification.
          </Text>
          <TouchableOpacity
            onPress={verifyPayment}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Vérifier maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace("/orders" as any)}
            style={styles.secondaryButton}
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              Voir mes commandes
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "success") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <SeatFlowHeader title="Confirmation" onClose={handleClose} />
        {seatSummaryModal}
        <Confetti active />
        <View style={styles.center}>
          <IconSymbol
            name="checkmark.circle.fill"
            size={64}
            color={colors.success}
          />
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Paiement confirmé
          </Text>
          <Text style={[styles.centerText, { color: colors.muted }]}>
            {orderId
              ? `Votre commande #${orderId} est confirmée.`
              : "Votre commande est confirmée."}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/orders" as any)}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>Voir mes commandes</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <SeatFlowHeader
        title={title}
        onClose={handleClose}
        selectedCount={visibleSelectedCount}
        onSeatSummary={() => setShowSeatSummary(true)}
      />
      {seatSummaryModal}
      <View style={styles.webViewFrame}>
        <WebViewComponent
          ref={webviewRef}
          source={{ uri: session!.seatUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="never"
          incognito
          thirdPartyCookiesEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavChange}
          renderLoading={() => (
            <View style={styles.loader}>
              <SeatingChartSkeleton />
            </View>
          )}
          onShouldStartLoadWithRequest={(request: any) => {
            const url = request.url || "";
            if (url.startsWith("ticketbylamako://")) return false;
            if (request.isTopFrame === false) {
              return url === "about:blank" || url.startsWith("https://");
            }
            return isAllowedWebViewUrl(url, "first-party");
          }}
          onHttpError={(event: any) => {
            const statusCode = Number(event?.nativeEvent?.statusCode || 0);
            const failedUrl = String(event?.nativeEvent?.url || "");
            const isSeatingSessionPage = isSeatingSessionUrl(failedUrl);
            if (
              statusCode === 404 &&
              phase === "seating" &&
              isSeatingSessionPage &&
              sessionRecoveryRef.current < 1
            ) {
              sessionRecoveryRef.current += 1;
              restartSeatingSession();
            }
          }}
          onError={(event: any) => {
            const description =
              event?.nativeEvent?.description || "Erreur WebView";
            Alert.alert("Erreur", description);
          }}
          bounces={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          onLoadEnd={() => {
            webviewRef.current?.injectJavaScript(
              "window.lamakoOpenSeatingChart && window.lamakoOpenSeatingChart(); true;",
            );
          }}
          onContentProcessDidTerminate={() => webviewRef.current?.reload()}
        />
      </View>
      {!seatDialogOpen ? (
        <View
          style={[
            styles.seatingFooter,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.seatingStatus, { color: colors.muted }]}
            accessibilityLiveRegion="polite"
            numberOfLines={2}
          >
            {pendingCount
              ? `${pendingCount} place(s) à ajouter au panier`
              : inCartCount
                ? `${inCartCount} place(s) prête(s) à confirmer`
                : status}
          </Text>
          <TouchableOpacity
            onPress={continueToCheckout}
            disabled={
              !inCartCount || !bridgeReady || checking || pendingCount > 0
            }
            accessibilityRole="button"
            accessibilityState={{
              disabled:
                !inCartCount || !bridgeReady || checking || pendingCount > 0,
              busy: checking,
            }}
            style={[
              styles.confirmSeatsButton,
              {
                backgroundColor: colors.primary,
                opacity:
                  inCartCount && bridgeReady && !checking && !pendingCount
                    ? 1
                    : 0.45,
              },
            ]}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmSeatsText}>
                {pendingCount
                  ? "Validez la place dans sa fenêtre"
                  : inCartCount
                    ? `Confirmer ${inCartCount} place(s)`
                    : "Sélectionnez une place"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

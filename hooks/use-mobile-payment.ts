import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as Crypto from "expo-crypto";

import {
  cancelMobilePayment,
  getMobilePaymentMethods,
  getMobilePaymentReturnStatus,
  startMobilePayment,
  updateMobilePaymentCoupon,
  verifyMobilePayment,
  type MobileOrderSummary,
  type MobilePaymentKind,
  type MobilePaymentMethod,
} from "@/lib/api/mobile";
import { useCart } from "@/lib/cart-provider";
import { openCommerceSession } from "@/lib/commerce-browser";
import { formatAriary } from "@/lib/format";

export type PaymentScreenPhase =
  | "loading"
  | "ready"
  | "starting"
  | "pending"
  | "review"
  | "error";

interface UseMobilePaymentOptions {
  token: string;
  kind: MobilePaymentKind;
}

const IN_PROGRESS_ATTEMPT_STATUSES = new Set([
  "queued",
  "processing",
  "pending",
  "redirect",
  "verification_delayed",
  "review",
]);

export function useMobilePayment({ token, kind }: UseMobilePaymentOptions) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { clearCart } = useCart();
  const [phase, setPhase] = useState<PaymentScreenPhase>("loading");
  const [order, setOrder] = useState<MobileOrderSummary | null>(null);
  const [methods, setMethods] = useState<MobilePaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [phone, setPhone] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [message, setMessage] = useState("");
  const [pollAfterMs, setPollAfterMs] = useState(2500);
  const [clock, setClock] = useState(Date.now());
  const pollInFlightRef = useRef(false);
  const isFocusedRef = useRef(isFocused);
  const terminalNavigationRef = useRef(false);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const selected = useMemo(
    () => methods.find((method) => method.id === selectedMethod) || null,
    [methods, selectedMethod],
  );
  const total = Number(order?.total || 0);
  const isZeroTotal = !!order && total <= 0;
  const paymentInProgress =
    order?.paymentStatus === "review" ||
    IN_PROGRESS_ATTEMPT_STATUSES.has(order?.paymentAttemptStatus || "");
  const expiresAt = order?.reservationExpiresAt
    ? Date.parse(order.reservationExpiresAt)
    : 0;
  const remainingSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - clock) / 1000))
    : null;
  const reservationCountdownComplete = remainingSeconds === 0;
  const reservationExpired = reservationCountdownComplete && !paymentInProgress;
  const paymentActionLabel = isZeroTotal
    ? "Confirmer la commande"
    : selected?.id === "papi_paiement"
      ? "Continuer vers Orange Money"
      : selected?.id === "cybersource"
        ? "Continuer vers le paiement par carte"
        : selected
          ? `Envoyer la demande ${selected.title}`
          : `Payer ${formatAriary(total)}`;
  const activePaymentMethod = paymentInProgress
    ? methods.find((method) => method.id === order?.paymentMethod) || selected
    : selected;

  useEffect(() => {
    if (!expiresAt || reservationCountdownComplete) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, reservationCountdownComplete]);

  const finish = useCallback(
    (status = "success") => {
      if (terminalNavigationRef.current) return;
      terminalNavigationRef.current = true;
      clearCart();
      router.replace({
        pathname: "/payment-return",
        params: { kind, token, status },
      } as any);
    },
    [clearCart, kind, router, token],
  );

  const load = useCallback(async () => {
    if (!token) {
      setMessage("Session de paiement introuvable.");
      setPhase("error");
      return;
    }
    setPhase("loading");
    setMessage("");
    try {
      const response = await getMobilePaymentMethods(token, kind);
      setOrder(response.order);
      setMethods(response.methods);
      setSelectedMethod((current) => {
        if (response.methods.some((method) => method.id === current)) {
          return current;
        }
        if (
          response.order.paymentMethod &&
          response.methods.some(
            (method) => method.id === response.order.paymentMethod,
          )
        ) {
          return response.order.paymentMethod;
        }
        return response.methods[0]?.id || "";
      });
      setPhone(response.order.billing?.phone || "");
      setPollAfterMs(response.pollAfterMs || 2500);
      if (response.order.paymentStatus === "success") {
        finish();
      } else if (response.order.paymentStatus === "review") {
        setMessage(
          "La confirmation de l'opérateur prend plus de temps que prévu. Ne payez pas une seconde fois; vérifiez à nouveau ou contactez le support.",
        );
        setPhase("review");
      } else if (
        response.order.paymentStatus === "pending" &&
        response.order.paymentAttemptStatus
      ) {
        setMessage(
          "Paiement envoyé. Confirmez-le auprès de votre opérateur; nous vérifions automatiquement son statut.",
        );
        setPhase("pending");
      } else {
        setPhase("ready");
      }
    } catch (error: any) {
      setMessage(error?.message || "Impossible de charger le paiement.");
      setPhase("error");
    }
  }, [finish, kind, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkStatus = useCallback(
    async (verifyProvider = false) => {
      if (!token || pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const status = verifyProvider
          ? await verifyMobilePayment(kind, token)
          : await getMobilePaymentReturnStatus(kind, token);
        if (status.order) setOrder(status.order);
        if (status.status === "success") {
          finish();
        } else if (status.status === "review") {
          setMessage(
            "La confirmation de l'opérateur est toujours en attente. Ne relancez pas le paiement; vérifiez à nouveau ou contactez le support.",
          );
          setPhase("review");
        } else if (["failed", "cancelled", "expired"].includes(status.status)) {
          setMessage(
            status.status === "expired"
              ? "La réservation a expiré. Reprenez votre sélection."
              : "Paiement non abouti. Veuillez réessayer.",
          );
          setPhase("error");
        } else {
          setPhase("pending");
        }
      } catch {
        // A network failure must not turn a provider payment into a failure.
      } finally {
        pollInFlightRef.current = false;
      }
    },
    [finish, kind, token],
  );

  const cancelPayment = useCallback(async () => {
    if (!token || phase === "starting") return;
    setPhase("starting");
    setMessage("");
    try {
      const response = await cancelMobilePayment(kind, token);
      if (response.order) setOrder(response.order);
      clearCart();
      router.replace({
        pathname: "/payment-return",
        params: { kind, token, status: "cancelled" },
      } as any);
    } catch (error: any) {
      try {
        const status = await verifyMobilePayment(kind, token);
        if (status.order) setOrder(status.order);
        if (status.status === "success") {
          finish();
          return;
        }
      } catch {
        // Keep the cancellation error when verification is unavailable.
      }
      setMessage(
        error?.message ||
          "Impossible de confirmer l'annulation. Le paiement n'a pas été relancé.",
      );
      setPhase("error");
    }
  }, [clearCart, finish, kind, phase, router, token]);

  useEffect(() => {
    if (!isFocused || (phase !== "pending" && phase !== "review")) return;
    const interval = Math.max(phase === "review" ? 15000 : 8000, pollAfterMs);
    const timer = setInterval(() => void checkStatus(true), interval);
    return () => clearInterval(timer);
  }, [checkStatus, isFocused, phase, pollAfterMs]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        isFocusedRef.current &&
        (phase === "pending" || phase === "review")
      ) {
        void checkStatus(true);
      }
    });
    return () => subscription.remove();
  }, [checkStatus, phase]);

  const applyCoupon = useCallback(
    async (action: "apply" | "remove") => {
      if (!token || (action === "apply" && !coupon.trim())) return;
      setCouponBusy(true);
      setCouponMessage("");
      try {
        const response = await updateMobilePaymentCoupon(
          token,
          kind,
          coupon.trim(),
          action,
        );
        setOrder(response.order);
        if (action === "remove") setCoupon("");
        setCouponMessage(
          action === "remove"
            ? "Le code promo a été retiré."
            : "Code promo appliqué. Le total a été mis à jour.",
        );
      } catch (error: any) {
        setCouponMessage(
          error?.message || "Ce code promo ne peut pas être appliqué.",
        );
      } finally {
        setCouponBusy(false);
      }
    },
    [coupon, kind, token],
  );

  const pay = useCallback(async () => {
    if (!token || !order) return;
    if (paymentInProgress) {
      await checkStatus(true);
      return;
    }
    if (reservationExpired) {
      setMessage("Cette réservation a expiré. Reprenez votre sélection.");
      setPhase("error");
      return;
    }
    if (!isZeroTotal && !selected) {
      setMessage("Sélectionnez un moyen de paiement.");
      return;
    }
    if (selected?.requiresPhone && !phone.trim()) {
      setMessage("Saisissez le numéro utilisé pour le paiement.");
      return;
    }

    setPhase("starting");
    setMessage("");
    try {
      const response = await startMobilePayment(token, kind, {
        attemptId: Crypto.randomUUID(),
        paymentMethod: selected?.id,
        billingPhone: phone.trim(),
      });
      setOrder(response.order);
      setPollAfterMs(response.pollAfterMs || 2500);

      if (response.flow === "success") {
        finish();
      } else if (response.flow === "pending") {
        setMessage(
          "La demande est envoyée. Confirmez-la sur votre téléphone; cette page se mettra à jour automatiquement.",
        );
        setPhase("pending");
      } else if (response.flow === "redirect" && response.redirectUrl) {
        await openCommerceSession(response.redirectUrl);
        // The provider callback can already have opened /payment-return.
        // Do not let this covered payment screen race the terminal route.
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!isFocusedRef.current || terminalNavigationRef.current) return;
        setMessage("Vérification du retour de paiement en cours...");
        setPhase("pending");
        await checkStatus(true);
      } else {
        setMessage(
          "Le prestataire n'a pas pu démarrer le paiement. Réessayez.",
        );
        setPhase("error");
      }
    } catch (error: any) {
      setMessage(error?.message || "Le paiement n'a pas pu démarrer.");
      setPhase("error");
    }
  }, [
    cancelPayment,
    checkStatus,
    finish,
    isZeroTotal,
    kind,
    order,
    paymentInProgress,
    phone,
    reservationExpired,
    selected,
    token,
  ]);

  return {
    activePaymentMethod,
    applyCoupon,
    cancelPayment,
    coupon,
    couponBusy,
    couponMessage,
    isZeroTotal,
    load,
    message,
    methods,
    order,
    pay,
    paymentActionLabel,
    paymentInProgress,
    phase,
    phone,
    remainingSeconds,
    reservationExpired,
    selected,
    selectedMethod,
    setCoupon,
    setMessage,
    setPhase,
    setPhone,
    setSelectedMethod,
  };
}

import { useEffect, useMemo, useRef, useState } from "react";

import { cancelMobilePayment } from "@/lib/api/mobile";
import { useCart } from "@/lib/cart-provider";
import { formatAriary } from "@/lib/format";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import {
  claimPaymentNotification,
  claimTerminalPaymentToken,
} from "@/lib/payment-flow-state";
import {
  isPaymentReturnPending,
  isPaymentReturnSuccess,
  normalizePaymentReturnKind,
  verifyPaymentReturn,
  type PaymentReturnStatus,
  type VerifiedPaymentReturn,
} from "@/lib/payment-return";

export type PaymentReturnPhase =
  | "verifying"
  | "success"
  | "pending"
  | "cancelled"
  | "failed";

interface UsePaymentReturnInput {
  kindParam: string;
  tokenParam: string;
  statusHint: string;
  fallbackOrderId: string;
  fallbackOrderNumber: string;
}

interface PaymentReturnOutcome {
  phase: Exclude<PaymentReturnPhase, "verifying">;
  message: string;
  clearCart: boolean;
}

export function usePaymentReturn({
  kindParam,
  tokenParam,
  statusHint,
  fallbackOrderId,
  fallbackOrderNumber,
}: UsePaymentReturnInput) {
  const { clearCart } = useCart();
  const notifiedRef = useRef(false);
  const [phase, setPhase] = useState<PaymentReturnPhase>("verifying");
  const [message, setMessage] = useState("Vérification du paiement...");
  const [result, setResult] = useState<VerifiedPaymentReturn | null>(null);

  useEffect(() => {
    claimTerminalPaymentToken(tokenParam);
    const kind = normalizePaymentReturnKind(kindParam);
    if (!kind || !tokenParam) {
      setMessage(
        "Lien de retour invalide. Ouvrez vos commandes pour vérifier le statut.",
      );
      setPhase("failed");
      return;
    }

    let disposed = false;
    setPhase("verifying");
    setMessage("Vérification sécurisée du paiement...");

    resolvePaymentReturn(kind, tokenParam, statusHint)
      .then((verified) => {
        if (disposed) return;
        setResult(verified);
        const outcome = describePaymentReturn(verified);
        if (outcome.clearCart) clearCart();
        notifySuccessOnce(verified, notifiedRef);
        setMessage(outcome.message);
        setPhase(outcome.phase);
      })
      .catch((error) => {
        if (disposed) return;
        console.warn("Payment return verification failed:", error);
        setMessage(
          "Impossible de vérifier le paiement pour le moment. Consultez vos commandes dans quelques instants.",
        );
        setPhase("failed");
      });

    return () => {
      disposed = true;
    };
  }, [clearCart, kindParam, statusHint, tokenParam]);

  const orderReference = useMemo(
    () =>
      result?.order?.number ||
      (result?.order?.id ? String(result.order.id) : "") ||
      fallbackOrderNumber ||
      fallbackOrderId,
    [fallbackOrderId, fallbackOrderNumber, result],
  );

  return {
    message,
    orderReference,
    phase,
    result,
    showTickets: phase === "success" && !!result?.ticketsReady,
  };
}

async function resolvePaymentReturn(
  kind: "checkout" | "seating",
  token: string,
  statusHint: string,
): Promise<VerifiedPaymentReturn> {
  if (statusHint !== "cancelled") {
    return verifyPaymentReturn({ kind, token, statusHint });
  }

  try {
    const cancelledPayment = await cancelMobilePayment(kind, token);
    return {
      kind: cancelledPayment.kind,
      token: cancelledPayment.token,
      status: cancelledPayment.status,
      order: cancelledPayment.order,
      ticketsReady: cancelledPayment.ticketsReady,
    };
  } catch (cancellationError) {
    // A late provider callback may have paid the order while cancellation ran.
    const verified = await verifyPaymentReturn({ kind, token });
    if (isPaymentReturnSuccess(verified.status)) return verified;
    throw cancellationError;
  }
}

function describePaymentReturn(
  verified: VerifiedPaymentReturn,
): PaymentReturnOutcome {
  if (isPaymentReturnSuccess(verified.status)) {
    return {
      phase: "success",
      message: verified.order?.id
        ? `Votre commande #${verified.order.number || verified.order.id} est confirmée.`
        : "Votre paiement est confirmé.",
      clearCart: true,
    };
  }
  if (isPaymentReturnPending(verified.status)) {
    return {
      phase: "pending",
      message:
        "Votre paiement est en attente de confirmation. La commande sera mise à jour après validation.",
      clearCart: false,
    };
  }
  if (verified.status === "cancelled") {
    return {
      phase: "cancelled",
      message: "Commande annulée. Aucun paiement n'a été confirmé.",
      clearCart: false,
    };
  }
  return {
    phase: "failed",
    message: paymentFailureMessage(verified.status),
    clearCart: false,
  };
}

function notifySuccessOnce(
  verified: VerifiedPaymentReturn,
  notifiedRef: { current: boolean },
) {
  if (!isPaymentReturnSuccess(verified.status) || !verified.order?.id) return;
  if (notifiedRef.current) return;
  if (!claimPaymentNotification(verified.order.id)) return;

  notifiedRef.current = true;
  notifyPaymentConfirmed(
    verified.order.id,
    formatAriary(Number(verified.order.total || 0)),
  ).catch(() => {});
}

function paymentFailureMessage(status: PaymentReturnStatus): string {
  if (status === "cancelled") {
    return "Commande annulée. Aucun paiement n'a été confirmé.";
  }
  if (status === "expired") {
    return "Cette session de paiement a expiré. Relancez le paiement depuis le panier ou les commandes.";
  }
  if (status === "failed") {
    return "Paiement non abouti. Veuillez réessayer.";
  }
  return "Le paiement n'est pas confirmé. Consultez vos commandes pour suivre son statut.";
}

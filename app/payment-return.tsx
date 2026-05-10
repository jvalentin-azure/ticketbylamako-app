import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { formatAriary } from "@/lib/format";
import { notifyPaymentConfirmed } from "@/lib/notifications";
import {
  firstParam,
  isPaymentReturnPending,
  isPaymentReturnSuccess,
  normalizePaymentReturnKind,
  verifyPaymentReturn,
  type PaymentReturnStatus,
  type VerifiedPaymentReturn,
} from "@/lib/payment-return";

type Phase = "verifying" | "success" | "pending" | "failed";

export default function PaymentReturnScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; token?: string; status?: string }>();
  const { clearCart } = useCart();
  const notifiedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState("Verification du paiement...");
  const [result, setResult] = useState<VerifiedPaymentReturn | null>(null);

  const kindParam = firstParam(params.kind);
  const tokenParam = firstParam(params.token);
  const statusHint = firstParam(params.status);

  useEffect(() => {
    const kind = normalizePaymentReturnKind(kindParam);
    if (!kind || !tokenParam) {
      setMessage("Lien de retour invalide. Ouvrez vos commandes pour verifier le statut.");
      setPhase("failed");
      return;
    }

    let cancelled = false;
    setPhase("verifying");
    setMessage("Verification securisee du paiement...");

    verifyPaymentReturn({ kind, token: tokenParam, statusHint })
      .then(verified => {
        if (cancelled) return;
        setResult(verified);

        if (isPaymentReturnSuccess(verified.status)) {
          clearCart();
          if (!notifiedRef.current && verified.order?.id) {
            notifiedRef.current = true;
            notifyPaymentConfirmed(
              verified.order.id,
              formatAriary(Number(verified.order.total || 0))
            ).catch(() => {});
          }
          setMessage(
            verified.order?.id
              ? `Votre commande #${verified.order.number || verified.order.id} est confirmee.`
              : "Votre paiement est confirme."
          );
          setPhase("success");
          return;
        }

        if (isPaymentReturnPending(verified.status)) {
          setMessage("Votre paiement est en attente de confirmation. La commande sera mise a jour apres validation.");
          setPhase("pending");
          return;
        }

        setMessage(paymentFailureMessage(verified.status));
        setPhase("failed");
      })
      .catch(err => {
        if (cancelled) return;
        console.warn("Payment return verification failed:", err);
        setMessage("Impossible de verifier le paiement pour le moment. Consultez vos commandes dans quelques instants.");
        setPhase("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [kindParam, tokenParam, statusHint]);

  const iconName: "checkmark.circle.fill" | "clock.fill" | "exclamationmark.triangle.fill" =
    phase === "success"
      ? "checkmark.circle.fill"
      : phase === "pending" || phase === "verifying"
        ? "clock.fill"
        : "exclamationmark.triangle.fill";
  const iconColor =
    phase === "success" ? colors.success : phase === "failed" ? colors.warning : colors.primary;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/" as any)} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Retour paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        {phase === "verifying" ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <IconSymbol name={iconName} size={64} color={iconColor} />
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>
          {phase === "success"
            ? "Paiement confirme"
            : phase === "pending"
              ? "Paiement en attente"
              : phase === "verifying"
                ? "Verification"
                : "Paiement non confirme"}
        </Text>
        <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>

        {result?.order?.total ? (
          <Text style={[styles.total, { color: colors.primary }]}>
            {formatAriary(Number(result.order.total || 0))}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => router.replace("/orders" as any)}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>Voir mes commandes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/" as any)} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function paymentFailureMessage(status: PaymentReturnStatus): string {
  if (status === "cancelled") return "Le paiement a ete annule. Votre commande reste consultable si elle a ete creee.";
  if (status === "expired") return "Cette session de paiement a expire. Relancez le paiement depuis le panier ou les commandes.";
  if (status === "failed") return "Le paiement n'a pas abouti. Vous pouvez reessayer depuis vos commandes si la commande existe.";
  return "Le paiement n'est pas confirme. Consultez vos commandes pour suivre son statut.";
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  title: { marginTop: 16, fontSize: 22, fontWeight: "800", textAlign: "center" },
  message: { marginTop: 10, fontSize: 14, lineHeight: 20, textAlign: "center" },
  total: { marginTop: 14, fontSize: 24, fontWeight: "800" },
  primaryButton: { marginTop: 26, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButton: { marginTop: 14, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
});

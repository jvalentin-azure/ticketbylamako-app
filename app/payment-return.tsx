import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Confetti } from "@/components/confetti";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { usePaymentReturn } from "@/hooks/use-payment-return";
import { formatAriary } from "@/lib/format";
import {
  claimPaymentCelebration,
  claimTerminalPaymentToken,
} from "@/lib/payment-flow-state";
import { replacePaymentFlowRoot } from "@/lib/payment-navigation";
import { firstParam } from "@/lib/payment-return";

export default function PaymentReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    token?: string;
    status?: string;
    orderId?: string;
    orderNumber?: string;
    normalized?: string;
  }>();
  const kindParam = firstParam(params.kind);
  const tokenParam = firstParam(params.token);
  const statusHint = firstParam(params.status);
  const fallbackOrderId = firstParam(params.orderId);
  const fallbackOrderNumber = firstParam(params.orderNumber);
  const normalized = firstParam(params.normalized) === "1";

  const normalizedDestination = useMemo(
    () =>
      ({
        pathname: "/payment-return",
        params: {
          kind: kindParam,
          token: tokenParam,
          status: statusHint,
          orderId: fallbackOrderId,
          orderNumber: fallbackOrderNumber,
          normalized: "1",
        },
      }) as const,
    [
      fallbackOrderId,
      fallbackOrderNumber,
      kindParam,
      statusHint,
      tokenParam,
    ],
  );

  useEffect(() => {
    claimTerminalPaymentToken(tokenParam);
    if (normalized) return;
    replacePaymentFlowRoot(router, normalizedDestination as any);
  }, [normalized, normalizedDestination, router, tokenParam]);

  if (!normalized) return <PaymentReturnPreparing />;

  return (
    <PaymentReturnResult
      kindParam={kindParam}
      tokenParam={tokenParam}
      statusHint={statusHint}
      fallbackOrderId={fallbackOrderId}
      fallbackOrderNumber={fallbackOrderNumber}
    />
  );
}

function PaymentReturnPreparing() {
  const colors = useColors();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.message, { color: colors.muted }]}>
          Finalisation sécurisée du paiement...
        </Text>
      </View>
    </ScreenContainer>
  );
}

interface PaymentReturnResultProps {
  kindParam: string;
  tokenParam: string;
  statusHint: string;
  fallbackOrderId: string;
  fallbackOrderNumber: string;
}

function PaymentReturnResult({
  kindParam,
  tokenParam,
  statusHint,
  fallbackOrderId,
  fallbackOrderNumber,
}: PaymentReturnResultProps) {
  const colors = useColors();
  const router = useRouter();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const { message, orderReference, phase, result, showTickets } =
    usePaymentReturn({
      kindParam,
      tokenParam,
      statusHint,
      fallbackOrderId,
      fallbackOrderNumber,
    });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const orderId = Number(result?.order?.id || 0);
    if (phase === "success" && claimPaymentCelebration(orderId)) {
      setCelebrate(true);
    }
  }, [phase, result?.order?.id]);

  const exitTo = (destination: Parameters<typeof router.replace>[0]) => {
    replacePaymentFlowRoot(router, destination);
  };

  const iconName:
    | "checkmark.circle.fill"
    | "clock.fill"
    | "exclamationmark.triangle.fill" =
    phase === "success"
      ? "checkmark.circle.fill"
      : phase === "pending" || phase === "verifying"
        ? "clock.fill"
        : "exclamationmark.triangle.fill";
  const iconColor =
    phase === "success"
      ? colors.success
      : phase === "failed" || phase === "cancelled"
        ? colors.warning
        : colors.primary;
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Confetti active={celebrate && !reduceMotion} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => exitTo("/(tabs)/" as any)}
          style={styles.backBtn}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Résultat du paiement
        </Text>
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
            ? "Paiement confirmé"
            : phase === "cancelled"
              ? "Paiement non abouti"
              : phase === "pending"
                ? "Paiement en attente"
                : phase === "verifying"
                  ? "Vérification"
                  : "Paiement non abouti"}
        </Text>
        <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>

        {orderReference ? (
          <View
            style={[
              styles.referenceCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.referenceLabel, { color: colors.muted }]}>
              RÉFÉRENCE DE COMMANDE
            </Text>
            <Text
              selectable
              style={[styles.referenceValue, { color: colors.foreground }]}
            >
              #{orderReference}
            </Text>
            <Text style={[styles.referenceHint, { color: colors.muted }]}>
              Conservez cette référence pour toute demande d'assistance.
            </Text>
          </View>
        ) : null}

        {result?.order?.total ? (
          <Text style={[styles.total, { color: colors.primary }]}>
            {formatAriary(Number(result.order.total || 0))}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            if (showTickets) {
              exitTo("/(tabs)/tickets" as any);
              return;
            }
            if (phase === "cancelled" || phase === "failed") {
              exitTo("/(tabs)/events" as any);
              return;
            }
            exitTo("/orders" as any);
          }}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>
            {showTickets
              ? "Voir mes billets"
              : phase === "cancelled" || phase === "failed"
                ? "Réessayer"
                : "Voir mes commandes"}
          </Text>
        </TouchableOpacity>
        {phase === "success" && showTickets ? (
          <TouchableOpacity
            onPress={() => exitTo("/orders" as any)}
            style={styles.secondaryButton}
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              Voir mes commandes
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => exitTo("/(tabs)/" as any)}
          style={styles.secondaryButton}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
            Retour à l'accueil
          </Text>
        </TouchableOpacity>
      </View>
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
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  message: { marginTop: 10, fontSize: 14, lineHeight: 20, textAlign: "center" },
  total: { marginTop: 14, fontSize: 24, fontWeight: "800" },
  referenceCard: {
    width: "100%",
    maxWidth: 380,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  referenceLabel: { fontSize: 11, fontFamily: "Raleway_800ExtraBold" },
  referenceValue: {
    marginTop: 5,
    fontSize: 22,
    fontFamily: "Raleway_800ExtraBold",
    fontVariant: ["tabular-nums"],
  },
  referenceHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: "Raleway_500Medium",
  },
  primaryButton: {
    width: "100%",
    maxWidth: 380,
    minHeight: 54,
    marginTop: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButton: {
    minHeight: 44,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
});

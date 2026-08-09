import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCart } from "@/lib/cart-provider";
import { formatAriary } from "@/lib/format";
import {
  getMobilePaymentMethods,
  getMobilePaymentReturnStatus,
  startMobilePayment,
  updateMobilePaymentCoupon,
  type MobileOrderSummary,
  type MobilePaymentKind,
  type MobilePaymentMethod,
} from "@/lib/api/mobile";

type ScreenPhase = "loading" | "ready" | "starting" | "pending" | "error";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function PaymentScreen() {
  const colors = useColors();
  const router = useRouter();
  const { clearCart } = useCart();
  const params = useLocalSearchParams<{ token?: string; kind?: string }>();
  const token = firstParam(params.token);
  const kind: MobilePaymentKind =
    firstParam(params.kind) === "seating" ? "seating" : "checkout";

  const [phase, setPhase] = useState<ScreenPhase>("loading");
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

  const selected = useMemo(
    () => methods.find((method) => method.id === selectedMethod) || null,
    [methods, selectedMethod],
  );
  const total = Number(order?.total || 0);
  const isZeroTotal = !!order && total <= 0;
  const expiresAt = order?.reservationExpiresAt
    ? Date.parse(order.reservationExpiresAt)
    : 0;
  const remainingSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - clock) / 1000))
    : null;
  const reservationExpired = remainingSeconds === 0;
  const paymentActionLabel = isZeroTotal
    ? "Confirmer la commande"
    : selected?.id === "papi_paiement"
      ? "Continuer vers Orange Money"
      : selected?.id === "cybersource"
        ? "Continuer vers le paiement par carte"
        : selected
          ? `Envoyer la demande ${selected.title}`
          : `Payer ${formatAriary(total)}`;

  useEffect(() => {
    if (!expiresAt || reservationExpired) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, reservationExpired]);

  const finish = (status = "success") => {
    clearCart();
    router.replace({
      pathname: "/payment-return",
      params: { kind, token, status },
    } as any);
  };

  const load = async () => {
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
      setPhone(response.order.billing?.phone || "");
      setPollAfterMs(response.pollAfterMs || 2500);
      if (response.order.paymentStatus === "success") {
        finish();
        return;
      }
      setSelectedMethod((current) =>
        response.methods.some((method) => method.id === current)
          ? current
          : response.methods[0]?.id || "",
      );
      setPhase("ready");
    } catch (error: any) {
      setMessage(error?.message || "Impossible de charger le paiement.");
      setPhase("error");
    }
  };

  useEffect(() => {
    void load();
  }, [token, kind]);

  const checkStatus = async () => {
    if (!token || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const status = await getMobilePaymentReturnStatus(kind, token);
      if (status.order) setOrder(status.order);
      if (status.status === "success") {
        finish();
        return;
      }
      if (["failed", "cancelled", "expired"].includes(status.status)) {
        setMessage(
          status.status === "expired"
            ? "La réservation a expiré. Reprenez votre sélection."
            : "Le paiement n'a pas abouti. Vous pouvez réessayer sans recréer la commande.",
        );
        setPhase("error");
      }
    } catch {
      // A temporary network failure must not turn a provider payment into a failure.
    } finally {
      pollInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (phase !== "pending") return;
    const timer = setInterval(() => void checkStatus(), Math.max(2000, pollAfterMs));
    return () => clearInterval(timer);
  }, [phase, pollAfterMs, token, kind]);

  const applyCoupon = async (action: "apply" | "remove") => {
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
  };

  const pay = async () => {
    if (!token || !order) return;
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
      const attemptId = Crypto.randomUUID();
      const response = await startMobilePayment(token, kind, {
        attemptId,
        paymentMethod: selected?.id,
        billingPhone: phone.trim(),
      });
      setOrder(response.order);
      setPollAfterMs(response.pollAfterMs || 2500);

      if (response.flow === "success") {
        finish();
        return;
      }
      if (response.flow === "pending") {
        setMessage(
          "La demande est envoyée. Confirmez-la sur votre téléphone; cette page se mettra à jour automatiquement.",
        );
        setPhase("pending");
        return;
      }
      if (response.flow === "redirect" && response.redirectUrl) {
        const returnUrl = Linking.createURL("payment-return", {
          queryParams: { kind, token },
        });
        const result = await WebBrowser.openAuthSessionAsync(
          response.redirectUrl,
          returnUrl,
          { preferEphemeralSession: false },
        );
        if (result.type === "success" && result.url) {
          const parsed = Linking.parse(result.url);
          const status = String(parsed.queryParams?.status || "");
          if (status === "success") {
            finish(status);
            return;
          }
        }
        setMessage("Vérification du retour de paiement en cours...");
        setPhase("pending");
        await checkStatus();
        return;
      }

      setMessage("Le prestataire n'a pas pu démarrer le paiement. Réessayez.");
      setPhase("error");
    } catch (error: any) {
      setMessage(error?.message || "Le paiement n'a pas pu démarrer.");
      setPhase("error");
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Header onBack={() => router.back()} colors={colors} />
        {remainingSeconds !== null ? (
          <ReservationTimer
            remainingSeconds={remainingSeconds}
            colors={colors}
          />
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Progress colors={colors} />

          {phase === "loading" ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.muted, { color: colors.muted }]}>Préparation du paiement...</Text>
            </View>
          ) : order ? (
            <>
              <OrderSummary order={order} colors={colors} />

              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <IconSymbol name="tag.fill" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Code promo</Text>
                </View>
                {order.couponCodes?.length ? (
                  <View style={[styles.appliedCoupon, { backgroundColor: colors.success + "18" }]}>
                    <Text style={[styles.appliedCouponText, { color: colors.success }]}>
                      {order.couponCodes.join(", ")} appliqué
                    </Text>
                    <TouchableOpacity onPress={() => void applyCoupon("remove")} disabled={couponBusy}>
                      <Text style={[styles.removeText, { color: colors.primary }]}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.couponRow}>
                    <TextInput
                      value={coupon}
                      onChangeText={setCoupon}
                      autoCapitalize="characters"
                      placeholder="Votre code"
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.input,
                        styles.couponInput,
                        { color: colors.foreground, borderColor: colors.border },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => void applyCoupon("apply")}
                      disabled={couponBusy || !coupon.trim()}
                      style={[
                        styles.smallButton,
                        { backgroundColor: colors.primary, opacity: coupon.trim() ? 1 : 0.45 },
                      ]}
                    >
                      {couponBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallButtonText}>Appliquer</Text>}
                    </TouchableOpacity>
                  </View>
                )}
                {couponMessage ? (
                  <View
                    style={[
                      styles.inlineMessage,
                      { borderColor: colors.border },
                    ]}
                  >
                    <IconSymbol
                      name="info.circle.fill"
                      size={18}
                      color={colors.warning}
                    />
                    <Text
                      style={[
                        styles.inlineMessageText,
                        { color: colors.foreground },
                      ]}
                    >
                      {couponMessage}
                    </Text>
                  </View>
                ) : null}
              </View>

              {!isZeroTotal ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Moyen de paiement</Text>
                  <Text style={[styles.helper, { color: colors.muted }]}>Choisissez puis confirmez. Vous restez dans l'application sauf autorisation externe obligatoire.</Text>
                  <View style={styles.methodList}>
                    {methods.map((method) => (
                      <PaymentMethodRow
                        key={method.id}
                        method={method}
                        selected={selectedMethod === method.id}
                        onPress={() => {
                          setSelectedMethod(method.id);
                          setMessage("");
                          setPhase("ready");
                        }}
                        colors={colors}
                      />
                    ))}
                  </View>
                  {selected?.flow === "redirect" ? (
                    <View
                      style={[
                        styles.inlineMessage,
                        { borderColor: colors.border },
                      ]}
                    >
                      <IconSymbol
                        name="arrow.up.right.square.fill"
                        size={18}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.inlineMessageText,
                          { color: colors.foreground },
                        ]}
                      >
                        {selected.id === "papi_paiement"
                          ? "Orange Money demandera l'autorisation sur sa page sécurisée, puis vous ramènera automatiquement dans l'application."
                          : "La banque ouvrira sa page sécurisée, puis vous ramènera automatiquement dans l'application."}
                      </Text>
                    </View>
                  ) : null}
                  {selected?.requiresPhone ? (
                    <View style={styles.phoneBlock}>
                      <Text style={[styles.label, { color: colors.foreground }]}>Numéro de paiement</Text>
                      <TextInput
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        placeholder="034 00 000 00"
                        placeholderTextColor={colors.muted}
                        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                      />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={[styles.zeroTotal, { backgroundColor: colors.success + "14" }]}>
                  <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} />
                  <Text style={[styles.zeroTotalText, { color: colors.foreground }]}>Aucun paiement requis après remise.</Text>
                </View>
              )}

            </>
          ) : (
            <View style={styles.loading}>
              <IconSymbol name="exclamationmark.triangle.fill" size={42} color={colors.warning} />
              <Text style={[styles.errorText, { color: colors.foreground }]}>{message}</Text>
              <TouchableOpacity onPress={() => void load()} style={[styles.smallButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.smallButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {order && phase !== "loading" ? (
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            {message ? (
              <View
                style={[
                  styles.message,
                  {
                    borderColor:
                      phase === "pending" ? colors.warning : colors.border,
                  },
                ]}
              >
                {phase === "pending" ? (
                  <ActivityIndicator size="small" color={colors.warning} />
                ) : (
                  <IconSymbol
                    name="info.circle.fill"
                    size={20}
                    color={colors.warning}
                  />
                )}
                <Text
                  style={[styles.messageText, { color: colors.foreground }]}
                >
                  {message}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() =>
                phase === "pending" ? void checkStatus() : void pay()
              }
              disabled={phase === "starting" || reservationExpired}
              style={[
                styles.payButton,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    phase === "starting" || reservationExpired ? 0.55 : 1,
                },
              ]}
            >
              {phase === "starting" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    name={phase === "pending" ? "arrow.clockwise" : "lock.fill"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.payButtonText}>
                    {phase === "pending"
                      ? "Vérifier le paiement"
                      : paymentActionLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {phase === "error" && !reservationExpired ? (
              <TouchableOpacity
                onPress={() => {
                  setMessage("");
                  setPhase("ready");
                }}
                style={styles.checkButton}
              >
                <Text
                  style={[styles.checkButtonText, { color: colors.primary }]}
                >
                  Modifier ou réessayer
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function ReservationTimer({
  remainingSeconds,
  colors,
}: {
  remainingSeconds: number;
  colors: any;
}) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const urgent = remainingSeconds <= 120;
  return (
    <View
      style={[
        styles.timer,
        { backgroundColor: urgent ? colors.error + "16" : colors.warning + "18" },
      ]}
    >
      <IconSymbol
        name="clock.fill"
        size={17}
        color={urgent ? colors.error : colors.warning}
      />
      <Text style={[styles.timerText, { color: colors.foreground }]}>
        Réservation maintenue encore
      </Text>
      <Text
        style={[
          styles.timerValue,
          { color: urgent ? colors.error : colors.foreground },
        ]}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Text>
    </View>
  );
}

function Header({ onBack, colors }: { onBack: () => void; colors: any }) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityLabel="Retour">
        <IconSymbol name="chevron.left" size={25} color={colors.foreground} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Paiement sécurisé</Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>TicketByLamako</Text>
      </View>
      <IconSymbol name="shield.fill" size={24} color={colors.success} />
    </View>
  );
}

function Progress({ colors }: { colors: any }) {
  const steps = [
    { label: "Billets", done: true },
    { label: "Informations", done: true },
    { label: "Paiement", done: false },
  ];
  return (
    <View style={styles.progress}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.progressItem}>
          <View style={[styles.progressDot, { backgroundColor: step.done ? colors.success : colors.warning }]}>
            {step.done ? <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" /> : <Text style={styles.progressNumber}>{index + 1}</Text>}
          </View>
          <Text style={[styles.progressLabel, { color: step.done ? colors.success : colors.foreground }]}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}

function OrderSummary({ order, colors }: { order: MobileOrderSummary; colors: any }) {
  const subtotal = Number(order.subtotal || order.total || 0);
  const discount = Number(order.discountTotal || 0);
  return (
    <View style={[styles.summary, { borderColor: colors.border }]}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>COMMANDE #{order.number || order.id}</Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Votre sélection</Text>
        </View>
        <IconSymbol name="ticket.fill" size={28} color={colors.primary} />
      </View>
      {order.items?.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View style={styles.itemCopy}>
            <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[styles.itemQty, { color: colors.muted }]}>{item.quantity} billet{item.quantity > 1 ? "s" : ""}</Text>
          </View>
          <Text style={[styles.itemPrice, { color: colors.foreground }]}>{formatAriary(Number(item.total || 0))}</Text>
        </View>
      ))}
      <View style={[styles.totalBlock, { borderTopColor: colors.border }]}>
        <SummaryLine label="Sous-total" value={formatAriary(subtotal)} colors={colors} />
        {discount > 0 ? <SummaryLine label="Remise" value={`-${formatAriary(discount)}`} colors={colors} accent /> : null}
        <View style={styles.grandTotalRow}>
          <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatAriary(Number(order.total || 0))}</Text>
        </View>
      </View>
    </View>
  );
}

function SummaryLine({ label, value, colors, accent = false }: { label: string; value: string; colors: any; accent?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLineLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.summaryLineValue, { color: accent ? colors.success : colors.foreground }]}>{value}</Text>
    </View>
  );
}

function PaymentMethodRow({ method, selected, onPress, colors }: { method: MobilePaymentMethod; selected: boolean; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.method,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary + "0D" : "transparent",
        },
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: selected ? colors.primary : colors.border }]}>
        <IconSymbol name={method.requiresPhone ? "phone.fill" : "banknote.fill"} size={21} color={selected ? "#fff" : colors.foreground} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>{method.title}</Text>
        <Text style={[styles.methodDescription, { color: colors.muted }]}>{method.description}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 18, fontFamily: "Raleway_800ExtraBold" },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontFamily: "Raleway_500Medium" },
  timer: { minHeight: 42, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  timerText: { fontSize: 12, fontFamily: "Raleway_600SemiBold" },
  timerValue: { marginLeft: 6, fontSize: 14, fontFamily: "Raleway_800ExtraBold", fontVariant: ["tabular-nums"] },
  content: { padding: 16, paddingBottom: 36, gap: 18 },
  progress: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressItem: { flex: 1, alignItems: "center", gap: 6 },
  progressDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  progressNumber: { color: "#fff", fontSize: 13, fontFamily: "Raleway_800ExtraBold" },
  progressLabel: { fontSize: 12, fontFamily: "Raleway_700Bold" },
  loading: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 24 },
  muted: { fontSize: 14, fontFamily: "Raleway_500Medium" },
  errorText: { textAlign: "center", fontSize: 15, lineHeight: 21, fontFamily: "Raleway_600SemiBold" },
  summary: { borderWidth: 1, borderRadius: 8, padding: 16 },
  summaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  eyebrow: { fontSize: 11, fontFamily: "Raleway_800ExtraBold" },
  summaryTitle: { marginTop: 3, fontSize: 20, fontFamily: "Raleway_800ExtraBold" },
  itemRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 11, gap: 12 },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 15, lineHeight: 20, fontFamily: "Raleway_700Bold" },
  itemQty: { marginTop: 3, fontSize: 12, fontFamily: "Raleway_500Medium" },
  itemPrice: { fontSize: 14, fontFamily: "Raleway_700Bold" },
  totalBlock: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, gap: 8 },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLineLabel: { fontSize: 13, fontFamily: "Raleway_500Medium" },
  summaryLineValue: { fontSize: 13, fontFamily: "Raleway_700Bold" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  grandTotalLabel: { fontSize: 17, fontFamily: "Raleway_800ExtraBold" },
  grandTotalValue: { fontSize: 22, fontFamily: "Raleway_800ExtraBold" },
  section: { gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: "Raleway_800ExtraBold" },
  helper: { fontSize: 13, lineHeight: 18, fontFamily: "Raleway_500Medium" },
  couponRow: { flexDirection: "row", gap: 10 },
  couponInput: { flex: 1 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, fontSize: 16, fontFamily: "Raleway_600SemiBold" },
  smallButton: { minHeight: 50, minWidth: 105, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  smallButtonText: { color: "#fff", fontSize: 14, fontFamily: "Raleway_800ExtraBold" },
  appliedCoupon: { minHeight: 50, borderRadius: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  appliedCouponText: { flex: 1, fontSize: 13, fontFamily: "Raleway_700Bold" },
  removeText: { fontSize: 13, fontFamily: "Raleway_800ExtraBold" },
  inlineMessage: { borderWidth: 1, borderRadius: 8, padding: 11, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  inlineMessageText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: "Raleway_600SemiBold" },
  methodList: { gap: 9 },
  method: { minHeight: 74, borderWidth: 1.5, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  methodIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  methodCopy: { flex: 1 },
  methodTitle: { fontSize: 15, fontFamily: "Raleway_700Bold" },
  methodDescription: { marginTop: 3, fontSize: 12, lineHeight: 16, fontFamily: "Raleway_500Medium" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  phoneBlock: { gap: 7 },
  label: { fontSize: 13, fontFamily: "Raleway_700Bold" },
  zeroTotal: { minHeight: 56, borderRadius: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  zeroTotalText: { flex: 1, fontSize: 14, fontFamily: "Raleway_700Bold" },
  message: { borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  messageText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: "Raleway_600SemiBold" },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 8 },
  payButton: { minHeight: 56, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18 },
  payButtonText: { color: "#fff", fontSize: 16, fontFamily: "Raleway_800ExtraBold" },
  checkButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  checkButtonText: { fontSize: 14, fontFamily: "Raleway_800ExtraBold" },
});

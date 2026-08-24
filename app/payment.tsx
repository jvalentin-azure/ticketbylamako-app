import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  OrderSummary,
  PaymentHeader,
  PaymentMethodRow,
  PaymentProgress,
  ReservationTimer,
} from "@/components/payment/PaymentScreenParts";
import { paymentStyles as styles } from "@/components/payment/payment-screen.styles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useMobilePayment } from "@/hooks/use-mobile-payment";
import { type MobilePaymentKind } from "@/lib/api/mobile";
import { getPaymentMethodPresentation } from "@/lib/payment-method-presentation";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function PaymentScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; kind?: string }>();
  const token = firstParam(params.token);
  const kind: MobilePaymentKind =
    firstParam(params.kind) === "seating" ? "seating" : "checkout";
  const [couponExpanded, setCouponExpanded] = useState(false);

  const payment = useMobilePayment({ token, kind });
  const {
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
    selectedMethod,
    setCoupon,
    setMessage,
    setPhase,
    setPhone,
    setSelectedMethod,
  } = payment;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PaymentHeader onBack={() => router.back()} colors={colors} />
        {remainingSeconds !== null ? (
          <ReservationTimer
            remainingSeconds={remainingSeconds}
            paymentInProgress={paymentInProgress}
            colors={colors}
          />
        ) : null}
        <ScrollView
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <PaymentProgress colors={colors} />

          {phase === "loading" ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.muted, { color: colors.muted }]}>
                Préparation du paiement...
              </Text>
            </View>
          ) : order ? (
            <>
              <OrderSummary order={order} colors={colors} />

              {!isZeroTotal ? (
                <View
                  style={[
                    styles.section,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.sectionTitle, { color: colors.foreground }]}
                  >
                    Moyen de paiement
                  </Text>
                  <Text style={[styles.helper, { color: colors.muted }]}>
                    Choisissez votre moyen de paiement. Les informations
                    demandées apparaîtront juste au bon endroit.
                  </Text>
                  <View style={styles.methodList}>
                    {methods.map((method) => {
                      const isCurrent =
                        (paymentInProgress
                          ? order?.paymentMethod
                          : selectedMethod) === method.id;
                      const presentation = getPaymentMethodPresentation(method);
                      return (
                        <PaymentMethodRow
                          key={method.id}
                          method={method}
                          selected={isCurrent}
                          disabled={paymentInProgress}
                          onPress={() => {
                            if (paymentInProgress) return;
                            setSelectedMethod(method.id);
                            setMessage("");
                            setPhase("ready");
                          }}
                          colors={colors}
                        >
                          {presentation.isMobileMoney ? (
                            <View style={styles.phoneBlock}>
                              <Text
                                style={[
                                  styles.label,
                                  { color: colors.foreground },
                                ]}
                              >
                                {presentation.phoneLabel}
                              </Text>
                              <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoComplete="tel"
                                placeholder={presentation.phonePlaceholder}
                                placeholderTextColor={colors.muted}
                                accessibilityLabel={presentation.phoneLabel}
                                style={[
                                  styles.input,
                                  {
                                    color: colors.foreground,
                                    borderColor: presentation.accent,
                                  },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.phoneHelper,
                                  { color: colors.muted },
                                ]}
                              >
                                Ce numéro sert uniquement à initier la demande
                                auprès de l’opérateur.
                              </Text>
                            </View>
                          ) : method.flow === "redirect" ? (
                            <View style={styles.providerHint}>
                              <IconSymbol
                                name="shield.fill"
                                size={17}
                                color={presentation.accent}
                              />
                              <Text
                                style={[
                                  styles.phoneHelper,
                                  { color: colors.muted },
                                ]}
                              >
                                La page sécurisée du prestataire s’ouvrira pour
                                finaliser le paiement.
                              </Text>
                            </View>
                          ) : null}
                        </PaymentMethodRow>
                      );
                    })}
                  </View>
                  {paymentInProgress && activePaymentMethod ? (
                    <View
                      style={[
                        styles.inlineMessage,
                        { borderColor: colors.warning },
                      ]}
                    >
                      <IconSymbol
                        name="clock.fill"
                        size={18}
                        color={colors.warning}
                      />
                      <Text
                        style={[
                          styles.inlineMessageText,
                          { color: colors.foreground },
                        ]}
                      >
                        {`${activePaymentMethod.title} est en cours de vérification. Attendez son résultat avant de choisir un autre moyen afin d'éviter un double débit.`}
                      </Text>
                    </View>
                  ) : null}
                  {phase === "error" && message ? (
                    <View
                      style={[
                        styles.inlineMessage,
                        { borderColor: colors.error },
                      ]}
                    >
                      <IconSymbol
                        name="exclamationmark.triangle.fill"
                        size={18}
                        color={colors.error}
                      />
                      <Text
                        style={[
                          styles.inlineMessageText,
                          { color: colors.foreground },
                        ]}
                      >
                        {message}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    styles.zeroTotal,
                    { backgroundColor: colors.success + "14" },
                  ]}
                >
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={22}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.zeroTotalText, { color: colors.foreground }]}
                  >
                    Aucun paiement requis après remise.
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setCouponExpanded((current) => !current)}
                  style={styles.couponToggle}
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: couponExpanded || !!order.couponCodes?.length,
                  }}
                >
                  <IconSymbol
                    name="tag.fill"
                    size={19}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.couponToggleText,
                      { color: colors.foreground },
                    ]}
                  >
                    {order.couponCodes?.length
                      ? "Code promo appliqué"
                      : "Ajouter un code promo"}
                  </Text>
                  <IconSymbol
                    name={couponExpanded ? "chevron.up" : "chevron.down"}
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>
                {couponExpanded || order.couponCodes?.length ? (
                  order.couponCodes?.length ? (
                    <View
                      style={[
                        styles.appliedCoupon,
                        { backgroundColor: colors.success + "18" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.appliedCouponText,
                          { color: colors.success },
                        ]}
                      >
                        {order.couponCodes.join(", ")} appliqué
                      </Text>
                      <TouchableOpacity
                        onPress={() => void applyCoupon("remove")}
                        disabled={couponBusy}
                      >
                        <Text
                          style={[styles.removeText, { color: colors.primary }]}
                        >
                          Retirer
                        </Text>
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
                          {
                            color: colors.foreground,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <TouchableOpacity
                        onPress={() => void applyCoupon("apply")}
                        disabled={couponBusy || !coupon.trim()}
                        style={[
                          styles.smallButton,
                          {
                            backgroundColor: colors.primary,
                            opacity: coupon.trim() ? 1 : 0.45,
                          },
                        ]}
                      >
                        {couponBusy ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.smallButtonText}>Appliquer</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                ) : null}
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
            </>
          ) : (
            <View style={styles.loading}>
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={42}
                color={colors.warning}
              />
              <Text style={[styles.errorText, { color: colors.foreground }]}>
                {message}
              </Text>
              <TouchableOpacity
                onPress={() => void load()}
                style={[
                  styles.smallButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.smallButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {order && phase !== "loading" ? (
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            {message && phase !== "error" ? (
              <View
                style={[
                  styles.message,
                  {
                    borderColor:
                      phase === "pending" || phase === "review"
                        ? colors.warning
                        : colors.border,
                  },
                ]}
              >
                {phase === "pending" || phase === "review" ? (
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
              onPress={() => void pay()}
              disabled={
                phase === "starting" ||
                phase === "pending" ||
                phase === "review" ||
                reservationExpired
              }
              style={[
                styles.payButton,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    phase === "starting" ||
                    phase === "pending" ||
                    phase === "review" ||
                    reservationExpired
                      ? 0.55
                      : 1,
                },
              ]}
            >
              {phase === "starting" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    name={
                      phase === "pending" || phase === "review"
                        ? "clock.fill"
                        : "lock.fill"
                    }
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.payButtonText}>
                    {phase === "pending" || phase === "review"
                      ? "Confirmation en cours..."
                      : paymentActionLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {phase === "pending" || phase === "review" ? (
              <>
                <Text style={[styles.statusHint, { color: colors.muted }]}>
                  La confirmation est automatique. Ne relancez pas un second
                  paiement.
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      "Annuler la commande ?",
                      "La réservation et la commande seront annulées. Aucun nouveau paiement ne sera lancé.",
                      [
                        { text: "Garder la commande", style: "cancel" },
                        {
                          text: "Annuler la commande",
                          style: "destructive",
                          onPress: () => void cancelPayment(),
                        },
                      ],
                    )
                  }
                  style={styles.checkButton}
                >
                  <Text
                    style={[styles.checkButtonText, { color: colors.warning }]}
                  >
                    Annuler la commande
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
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

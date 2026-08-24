import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import { paymentStyles as styles } from "@/components/payment/payment-screen.styles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { MobileOrderSummary, MobilePaymentMethod } from "@/lib/api/mobile";
import { formatAriary } from "@/lib/format";
import { getPaymentMethodPresentation } from "@/lib/payment-method-presentation";

type Colors = Record<string, string>;

export function ReservationTimer({
  remainingSeconds,
  paymentInProgress = false,
  colors,
}: {
  remainingSeconds: number;
  paymentInProgress?: boolean;
  colors: Colors;
}) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const urgent = remainingSeconds <= 120;
  const protectedPayment = paymentInProgress && remainingSeconds === 0;
  return (
    <View
      style={[
        styles.timer,
        {
          backgroundColor: urgent ? colors.error + "16" : colors.warning + "18",
        },
      ]}
    >
      <IconSymbol
        name="clock.fill"
        size={17}
        color={urgent ? colors.error : colors.warning}
      />
      <Text style={[styles.timerText, { color: colors.foreground }]}>
        {protectedPayment
          ? "Paiement en cours, réservation protégée"
          : "Réservation maintenue encore"}
      </Text>
      <Text
        style={[
          styles.timerValue,
          { color: urgent ? colors.error : colors.foreground },
        ]}
      >
        {protectedPayment
          ? "EN COURS"
          : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
      </Text>
    </View>
  );
}

export function PaymentHeader({
  onBack,
  colors,
}: {
  onBack: () => void;
  colors: Colors;
}) {
  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <IconSymbol name="chevron.left" size={25} color={colors.foreground} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Paiement sécurisé
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
          TicketByLamako
        </Text>
      </View>
      <IconSymbol name="shield.fill" size={24} color={colors.success} />
    </View>
  );
}

export function PaymentProgress({ colors }: { colors: Colors }) {
  const steps = [
    { label: "Billets", done: true },
    { label: "Informations", done: true },
    { label: "Paiement", done: false },
  ];
  return (
    <View
      style={[
        styles.progress,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {steps.map((step, index) => (
        <View key={step.label} style={styles.progressGroup}>
          <View style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                {
                  backgroundColor: step.done ? colors.success : colors.warning,
                },
              ]}
            >
              {step.done ? (
                <IconSymbol name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={styles.progressNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                { color: step.done ? colors.success : colors.foreground },
              ]}
            >
              {step.label}
            </Text>
          </View>
          {index < steps.length - 1 ? (
            <View
              style={[
                styles.progressConnector,
                {
                  backgroundColor: step.done
                    ? colors.success + "55"
                    : colors.border,
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function OrderSummary({
  order,
  colors,
}: {
  order: MobileOrderSummary;
  colors: Colors;
}) {
  const subtotal = Number(order.subtotal || order.total || 0);
  const discount = Number(order.discountTotal || 0);
  const ticketCount = (order.items || []).reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );
  return (
    <View
      style={[
        styles.summary,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.summaryHeader}>
        <View style={styles.summaryHeaderCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            COMMANDE #{order.number || order.id}
          </Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            Votre sélection
          </Text>
        </View>
        <View
          style={[
            styles.ticketCountBadge,
            { backgroundColor: colors.primary + "14" },
          ]}
        >
          <IconSymbol name="ticket.fill" size={17} color={colors.primary} />
          <Text style={[styles.ticketCountText, { color: colors.primary }]}>
            {ticketCount} billet{ticketCount > 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      {order.items?.map((item) => (
        <View
          key={item.id}
          style={[
            styles.itemRow,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.itemAccent, { backgroundColor: colors.primary }]}
          />
          <View style={styles.itemCopy}>
            <Text style={[styles.itemType, { color: colors.primary }]}>BILLET</Text>
            <Text style={[styles.itemName, { color: colors.foreground }]}>
              {item.name}
            </Text>
            <Text style={[styles.itemQty, { color: colors.muted }]}>
              {item.quantity} billet{item.quantity > 1 ? "s" : ""}
            </Text>
            {item.seatLabels?.length ? (
              <View style={styles.seatRow}>
                <IconSymbol
                  name="chair.fill"
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.seatText, { color: colors.primary }]}>
                  {item.seatLabels.join(", ")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.itemPrice, { color: colors.foreground }]}>
            {formatAriary(Number(item.total || 0))}
          </Text>
        </View>
      ))}
      <View style={[styles.totalBlock, { borderTopColor: colors.border }]}>
        <SummaryLine
          label="Sous-total"
          value={formatAriary(subtotal)}
          colors={colors}
        />
        {discount > 0 ? (
          <View
            style={[
              styles.discountRow,
              { backgroundColor: colors.success + "12" },
            ]}
          >
            <SummaryLine
              label="Remise appliquée"
              value={`-${formatAriary(discount)}`}
              colors={colors}
              accent
            />
          </View>
        ) : null}
        <View style={styles.grandTotalRow}>
          <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>
            Total
          </Text>
          <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
            {formatAriary(Number(order.total || 0))}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SummaryLine({
  label,
  value,
  colors,
  accent = false,
}: {
  label: string;
  value: string;
  colors: Colors;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLineLabel, { color: colors.muted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryLineValue,
          { color: accent ? colors.success : colors.foreground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function PaymentMethodRow({
  method,
  selected,
  disabled,
  onPress,
  colors,
  children,
}: {
  method: MobilePaymentMethod;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: Colors;
  children?: ReactNode;
}) {
  const presentation = getPaymentMethodPresentation(method);
  return (
    <View
      style={[
        styles.method,
        {
          borderColor: selected ? presentation.accent : colors.border,
          backgroundColor: selected
            ? presentation.accent + "0D"
            : colors.surface,
          opacity: disabled && !selected ? 0.45 : 1,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityLabel={method.title}
        accessibilityState={{ disabled, selected }}
        activeOpacity={0.74}
        style={styles.methodMain}
      >
        <View
          style={[
            styles.methodAccent,
            { backgroundColor: presentation.accent },
          ]}
        />
        <View
          style={[
            styles.methodIcon,
            {
              backgroundColor: method.iconUrl
                ? "#fff"
                : presentation.accent + "18",
            },
          ]}
        >
          {method.iconUrl ? (
            <Image
              source={{ uri: method.iconUrl }}
              style={styles.methodLogo}
              contentFit="contain"
              transition={120}
            />
          ) : (
            <IconSymbol
              name={presentation.isMobileMoney ? "phone.fill" : "banknote.fill"}
              size={21}
              color={presentation.accent}
            />
          )}
        </View>
        <View style={styles.methodCopy}>
          <Text style={[styles.methodTitle, { color: colors.foreground }]}>
            {method.title}
          </Text>
          <Text style={[styles.methodDescription, { color: colors.muted }]}>
            {method.description}
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            { borderColor: selected ? presentation.accent : colors.border },
          ]}
        >
          {selected ? (
            <View
              style={[
                styles.radioInner,
                { backgroundColor: presentation.accent },
              ]}
            />
          ) : null}
        </View>
      </TouchableOpacity>
      {selected && children ? (
        <View
          style={[
            styles.methodExpansion,
            { borderTopColor: presentation.accent + "30" },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

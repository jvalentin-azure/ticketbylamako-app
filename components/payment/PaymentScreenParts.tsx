import { Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import { paymentStyles as styles } from "@/components/payment/payment-screen.styles";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { MobileOrderSummary, MobilePaymentMethod } from "@/lib/api/mobile";
import { formatAriary } from "@/lib/format";

type Colors = Record<string, string>;

export function ReservationTimer({ remainingSeconds, paymentInProgress = false, colors }: { remainingSeconds: number; paymentInProgress?: boolean; colors: Colors }) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const urgent = remainingSeconds <= 120;
  const protectedPayment = paymentInProgress && remainingSeconds === 0;
  return (
    <View style={[styles.timer, { backgroundColor: urgent ? colors.error + "16" : colors.warning + "18" }]}>
      <IconSymbol name="clock.fill" size={17} color={urgent ? colors.error : colors.warning} />
      <Text style={[styles.timerText, { color: colors.foreground }]}>
        {protectedPayment ? "Paiement en cours, réservation protégée" : "Réservation maintenue encore"}
      </Text>
      <Text style={[styles.timerValue, { color: urgent ? colors.error : colors.foreground }]}>
        {protectedPayment ? "EN COURS" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
      </Text>
    </View>
  );
}

export function PaymentHeader({ onBack, colors }: { onBack: () => void; colors: Colors }) {
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

export function PaymentProgress({ colors }: { colors: Colors }) {
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

export function OrderSummary({ order, colors }: { order: MobileOrderSummary; colors: Colors }) {
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

function SummaryLine({ label, value, colors, accent = false }: { label: string; value: string; colors: Colors; accent?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLineLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.summaryLineValue, { color: accent ? colors.success : colors.foreground }]}>{value}</Text>
    </View>
  );
}

export function PaymentMethodRow({ method, selected, disabled, onPress, colors }: { method: MobilePaymentMethod; selected: boolean; disabled: boolean; onPress: () => void; colors: Colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      activeOpacity={0.8}
      style={[styles.method, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "0D" : "transparent", opacity: disabled && !selected ? 0.45 : 1 }]}
    >
      <View style={[styles.methodIcon, { backgroundColor: method.iconUrl ? "#fff" : selected ? colors.primary : colors.border }]}>
        {method.iconUrl ? (
          <Image source={{ uri: method.iconUrl }} style={styles.methodLogo} contentFit="contain" transition={120} />
        ) : (
          <IconSymbol name={method.requiresPhone ? "phone.fill" : "banknote.fill"} size={21} color={selected ? "#fff" : colors.foreground} />
        )}
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

import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCart } from "@/lib/cart-provider";
import { cartHoldRemainingMs } from "@/lib/cart-store";

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GlobalCartHoldBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { expiresAt, itemCount } = useCart();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt || itemCount === 0) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, itemCount]);

  const remaining = useMemo(
    () => cartHoldRemainingMs(expiresAt, now),
    [expiresAt, now],
  );
  if (!expiresAt || itemCount === 0 || remaining <= 0) return null;

  const urgent = remaining <= 2 * 60 * 1000;
  const warning = remaining <= 5 * 60 * 1000;
  const accent = urgent ? "#DC2626" : warning ? "#D97706" : "#704016";
  const background = urgent ? "#FEF2F2" : warning ? "#FFFBEB" : "#FFF9F0";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le panier. ${itemCount} billet${itemCount > 1 ? "s" : ""}, réservation pendant encore ${formatRemaining(remaining)}`}
      onPress={() => router.push("/(tabs)/cart" as any)}
      activeOpacity={0.9}
      style={[
        styles.banner,
        {
          top: Math.max(insets.top, 8) + 56,
          backgroundColor: background,
          borderColor: accent,
        },
      ]}
    >
      <IconSymbol name="clock.fill" size={15} color={accent} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
          Réservation en cours
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {itemCount} billet{itemCount > 1 ? "s" : ""} dans le panier
        </Text>
      </View>
      <Text style={[styles.timer, { color: accent }]}>
        {formatRemaining(remaining)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    right: 12,
    zIndex: 1000,
    elevation: 12,
    minHeight: 48,
    maxWidth: 310,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 12, fontWeight: "800" },
  detail: { color: "#4B5563", fontSize: 10, marginTop: 1 },
  timer: { fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
});

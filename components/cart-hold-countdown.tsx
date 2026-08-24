import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { cartHoldRemainingMs } from "@/lib/cart-store";

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CartHoldCountdown({ expiresAt }: { expiresAt: number | null }) {
  const colors = useColors();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const remaining = useMemo(
    () => cartHoldRemainingMs(expiresAt, now),
    [expiresAt, now],
  );

  if (!expiresAt || remaining <= 0) return null;

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`Votre sélection est réservée pendant encore ${formatRemaining(remaining)}`}
      style={[
        styles.container,
        {
          backgroundColor: colors.warning + "14",
          borderColor: colors.warning + "55",
        },
      ]}
    >
      <IconSymbol name="clock.fill" size={18} color={colors.warning} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Sélection réservée pendant
        </Text>
        <Text style={[styles.detail, { color: colors.muted }]}>
          Le délai continue pendant votre navigation.
        </Text>
      </View>
      <Text style={[styles.time, { color: colors.foreground }]}>
        {formatRemaining(remaining)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700" },
  detail: { marginTop: 2, fontSize: 11, lineHeight: 15 },
  time: { fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
});

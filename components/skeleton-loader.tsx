import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useColors } from "@/hooks/use-colors";

function SkeletonBlock({ width, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) {
  const colors = useColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
        },
        animStyle,
        style,
      ]}
    />
  );
}

/**
 * Skeleton loader for seating chart WebView loading state.
 * Shows a placeholder that looks like a seating chart is loading.
 */
export function SeatingChartSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <SkeletonBlock width={120} height={20} />
        <SkeletonBlock width={80} height={20} />
      </View>

      {/* Stage area */}
      <View style={styles.stageArea}>
        <SkeletonBlock width={200} height={30} borderRadius={15} />
      </View>

      {/* Seat rows */}
      <View style={styles.seatsArea}>
        {[0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1, 0.95, 0.9].map((scale, i) => (
          <View key={i} style={[styles.seatRow, { width: `${scale * 80}%` }]}>
            {Array.from({ length: Math.floor(scale * 12) }).map((_, j) => (
              <SkeletonBlock
                key={j}
                width={20}
                height={20}
                borderRadius={4}
                style={{ margin: 2 }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Bottom bar skeleton */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <SkeletonBlock width={100} height={16} />
        <SkeletonBlock width={140} height={40} borderRadius={20} />
      </View>
    </View>
  );
}

/**
 * Generic skeleton loader for checkout WebView.
 */
export function CheckoutSkeleton() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
      {/* Order summary */}
      <SkeletonBlock width="60%" height={18} style={{ marginBottom: 16 }} />
      <View style={{ gap: 12, marginBottom: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <SkeletonBlock width="50%" height={14} />
          <SkeletonBlock width={60} height={14} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width={60} height={14} />
        </View>
      </View>

      {/* Payment methods */}
      <SkeletonBlock width="40%" height={18} style={{ marginBottom: 12 }} />
      <View style={{ gap: 10, marginBottom: 24 }}>
        <SkeletonBlock width="100%" height={50} borderRadius={12} />
        <SkeletonBlock width="100%" height={50} borderRadius={12} />
        <SkeletonBlock width="100%" height={50} borderRadius={12} />
      </View>

      {/* Terms */}
      <SkeletonBlock width="80%" height={14} style={{ marginBottom: 20 }} />

      {/* Submit button */}
      <SkeletonBlock width="100%" height={48} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  stageArea: {
    alignItems: "center",
    paddingVertical: 20,
  },
  seatsArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  seatRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
  },
});

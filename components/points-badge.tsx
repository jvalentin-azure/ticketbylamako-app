import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { estimatePointsForPrice, TIERS } from "@/lib/rewards-provider";

interface PointsBadgeProps {
  /** Price in Ariary (number or string) */
  price: number | string;
  /** Compact mode for shop grid cards (smaller text) */
  compact?: boolean;
  /** User's current tier multiplier (default 1) */
  multiplier?: number;
  /** User's current tier name for bonus display */
  tierName?: string;
}

/**
 * Dynamic LamakoRewards points badge.
 * Shows how many points a user would earn for a given price.
 * 
 * Usage:
 * ```tsx
 * <PointsBadge price={120000} />           // compact by default
 * <PointsBadge price={120000} compact={false} multiplier={1.25} tierName="Gold" />
 * ```
 */
export function PointsBadge({ price, compact = true, multiplier = 1, tierName }: PointsBadgeProps) {
  const colors = useColors();
  const priceNum = typeof price === "string" ? parseFloat(price) || 0 : price;
  const points = estimatePointsForPrice(priceNum, multiplier);

  if (points <= 0) return null;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.compactDot, { backgroundColor: "#f59e0b" }]}>
          <Text style={styles.compactStar}>★</Text>
        </View>
        <Text style={[styles.compactText, { color: "#b45309" }]}>
          +{points} pts
        </Text>
      </View>
    );
  }

  // Detailed badge for product/event detail pages
  return (
    <View style={[styles.detailContainer, { borderColor: "#e8d5a3" }]}>
      <View style={styles.detailRow}>
        <View style={[styles.detailIcon, { backgroundColor: "#f59e0b" }]}>
          <Text style={styles.detailStar}>★</Text>
        </View>
        <View style={styles.detailContent}>
          <Text style={styles.detailTitle}>
            Gagnez <Text style={styles.detailPoints}>{points} points</Text> LamakoRewards
          </Text>
          {multiplier > 1 && tierName && (
            <Text style={styles.detailBonus}>
              Bonus {tierName} : x{multiplier}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact badge (for grid cards)
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  compactDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  compactStar: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  compactText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Detailed badge (for detail pages)
  detailContainer: {
    backgroundColor: "#fdf6ee",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailStar: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  detailContent: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3d2314",
  },
  detailPoints: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b45309",
  },
  detailBonus: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 2,
  },
});

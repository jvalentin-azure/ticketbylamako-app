import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { formatAriary } from "@/lib/format";
import { REDEMPTION_TIERS } from "@/lib/rewards-provider";

interface CheckoutRewardsPanelProps {
  pointsToEarn: number;
  availablePoints: number;
  canRedeem: boolean;
  allItemsEligible: boolean;
  isRedeeming: boolean;
  redeemError: string | null;
  appliedCoupon: string | null;
  appliedDiscount: number;
  tierName?: string;
  tierMultiplier?: number;
  onRedeem: (points: number) => void;
  onRemoveCoupon: () => void;
}

export function CheckoutRewardsPanel({
  pointsToEarn,
  availablePoints,
  canRedeem,
  allItemsEligible,
  isRedeeming,
  redeemError,
  appliedCoupon,
  appliedDiscount,
  tierName,
  tierMultiplier = 1,
  onRedeem,
  onRemoveCoupon,
}: CheckoutRewardsPanelProps) {
  const showRedeem =
    allItemsEligible && canRedeem && availablePoints >= 500 && !appliedCoupon;

  return (
    <View
      style={{
        backgroundColor: "#fdf6ee",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e8d5a3",
        padding: 12,
      }}
    >
      {pointsToEarn > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "#f59e0b",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              ★
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#3d2314" }}>
              Gagnez{" "}
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: "#b45309" }}
              >
                {pointsToEarn} points
              </Text>{" "}
              LamakoRewards
            </Text>
            {tierMultiplier > 1 && tierName ? (
              <Text style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                Bonus {tierName} : x{tierMultiplier}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {showRedeem ? (
        <View
          style={{
            borderTopWidth: pointsToEarn > 0 ? 1 : 0,
            borderTopColor: "#e8d5a3",
            marginTop: pointsToEarn > 0 ? 10 : 0,
            paddingTop: pointsToEarn > 0 ? 10 : 0,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: "#3d2314",
              marginBottom: 8,
            }}
          >
            Utiliser mes points ({availablePoints} pts)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {REDEMPTION_TIERS.filter(
              (tier) => tier.points <= availablePoints,
            ).map((tier) => (
              <TouchableOpacity
                key={tier.points}
                onPress={() => onRedeem(tier.points)}
                disabled={isRedeeming}
                accessibilityRole="button"
                accessibilityLabel={`Utiliser ${tier.points} points pour une réduction de ${formatAriary(tier.value)}`}
                style={{
                  backgroundColor: "#b45309",
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  opacity: isRedeeming ? 0.5 : 1,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
                >
                  -{formatAriary(tier.value)}
                </Text>
                <Text style={{ color: "#fde68a", fontSize: 10 }}>
                  {tier.points} pts
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {isRedeeming ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
              }}
            >
              <ActivityIndicator size="small" color="#b45309" />
              <Text style={{ fontSize: 12, color: "#92400e" }}>
                Échange en cours...
              </Text>
            </View>
          ) : null}
          {redeemError ? (
            <Text style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>
              {redeemError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!allItemsEligible ? (
        <Text
          style={{
            fontSize: 11,
            color: "#92400e",
            marginTop: pointsToEarn > 0 ? 10 : 0,
          }}
        >
          Les points LamakoRewards ne sont pas disponibles sur tous les articles
          de ce panier.
        </Text>
      ) : null}

      {appliedCoupon ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: pointsToEarn > 0 ? 10 : 0,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#15803d" }}>
              ✓ Réduction appliquée : -{formatAriary(appliedDiscount)}
            </Text>
            <Text style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
              Coupon : {appliedCoupon}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRemoveCoupon}
            accessibilityRole="button"
            accessibilityLabel="Retirer la réduction LamakoRewards"
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "600" }}>
              Retirer
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

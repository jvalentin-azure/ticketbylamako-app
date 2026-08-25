import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { CartHoldCountdown } from "@/components/cart-hold-countdown";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CheckoutRewardsPanel } from "@/components/commerce/CheckoutRewardsPanel";
import {
  TicketCustomFieldsForm,
  type BuyerFieldValues,
  type TicketFieldValues,
} from "@/components/commerce/TicketCustomFieldsForm";
import { useColors } from "@/hooks/use-colors";
import type { CartItem } from "@/lib/cart-provider";
import type { MobileCheckoutFieldsResponse } from "@/lib/api/mobile";
import { formatAriary } from "@/lib/format";
import { useRewards } from "@/lib/rewards-provider";

export function CheckoutHeader({
  title,
  onBack,
  expiresAt,
}: {
  title: string;
  onBack: () => void;
  expiresAt?: number | null;
}) {
  const colors = useColors();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={{ width: 40, alignItems: "flex-start", paddingVertical: 4 }}
        >
          <IconSymbol
            name="chevron.left"
            size={24}
            color={colors.foreground}
          />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: colors.foreground,
            fontSize: 17,
            fontWeight: "700",
          }}
        >
          {title}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <CartHoldCountdown expiresAt={expiresAt ?? null} />
    </View>
  );
}

function SummaryCard({
  itemCount,
  total,
  discount = 0,
}: {
  itemCount: number;
  total: number;
  discount?: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}
      >
        Récapitulatif
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
        {itemCount} article{itemCount > 1 ? "s" : ""} · Total :{" "}
        {formatAriary(Math.max(0, total - discount))}
      </Text>
      {discount > 0 ? (
        <Text
          style={{
            color: "#15803d",
            fontSize: 13,
            fontWeight: "600",
            marginTop: 4,
          }}
        >
          Réduction : -{formatAriary(discount)}
        </Text>
      ) : null}
    </View>
  );
}

interface RewardsProps {
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

function RewardsPanel(props: RewardsProps) {
  const { programConfig } = useRewards();
  const firstRedemptionTier =
    programConfig.redemptionTiers[0]?.points ?? Infinity;
  const visible =
    programConfig.enabled &&
    (props.pointsToEarn > 0 ||
      !props.allItemsEligible ||
      props.availablePoints >= firstRedemptionTier ||
      Boolean(props.appliedCoupon));
  return visible ? <CheckoutRewardsPanel {...props} /> : null;
}

interface ShippingStepProps extends RewardsProps {
  expiresAt: number | null;
  items: CartItem[];
  total: number;
  phone: string;
  address: string;
  city: string;
  loading: boolean;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ShippingStep(props: ShippingStepProps) {
  const colors = useColors();
  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.foreground,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  const continueCheckout = () => {
    if (!props.phone.trim() || !props.address.trim() || !props.city.trim()) {
      Alert.alert(
        "Champs requis",
        "Veuillez remplir tous les champs obligatoires.",
      );
      return;
    }
    props.onContinue();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <CheckoutHeader
        title="Adresse de livraison"
        onBack={props.onBack}
        expiresAt={props.expiresAt}
      />
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Renseignez l'adresse utilisée pour la livraison de vos produits.
        </Text>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Téléphone *
          </Text>
          <TextInput
            value={props.phone}
            onChangeText={props.onPhoneChange}
            keyboardType="phone-pad"
            returnKeyType="next"
            placeholder="034 XX XXX XX"
            style={inputStyle}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Adresse *
          </Text>
          <TextInput
            value={props.address}
            onChangeText={props.onAddressChange}
            placeholder="Rue, numéro, quartier..."
            returnKeyType="next"
            style={inputStyle}
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Ville *
          </Text>
          <TextInput
            value={props.city}
            onChangeText={props.onCityChange}
            placeholder="Antananarivo"
            returnKeyType="done"
            style={inputStyle}
            placeholderTextColor={colors.muted}
          />
        </View>
        <SummaryCard
          itemCount={props.items.length}
          total={props.total}
          discount={props.appliedDiscount}
        />
        <RewardsPanel {...props} />
        <TouchableOpacity
          onPress={continueCheckout}
          disabled={props.loading}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            opacity: props.loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {props.loading ? "Vérification..." : "Continuer vers le paiement"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

interface ConfirmStepProps extends RewardsProps {
  expiresAt: number | null;
  itemCount: number;
  total: number;
  loading: boolean;
  onContinue: () => void;
  onBack: () => void;
}

export function ConfirmStep(props: ConfirmStepProps) {
  const colors = useColors();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <CheckoutHeader
        title="Confirmation"
        onBack={props.onBack}
        expiresAt={props.expiresAt}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
      >
        <SummaryCard
          itemCount={props.itemCount}
          total={props.total}
          discount={props.appliedDiscount}
        />
        <RewardsPanel {...props} />
        <TouchableOpacity
          onPress={props.onContinue}
          disabled={props.loading}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            opacity: props.loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {props.loading
              ? "Vérification..."
              : props.appliedCoupon
                ? `Payer ${formatAriary(Math.max(0, props.total - props.appliedDiscount))}`
                : "Continuer vers le paiement"}
          </Text>
        </TouchableOpacity>
        {!props.appliedCoupon ? (
          <TouchableOpacity
            onPress={props.onContinue}
            disabled={props.loading}
            accessibilityRole="button"
            style={{ alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Passer sans utiliser mes points
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

interface TicketFieldsStepProps {
  expiresAt: number | null;
  items: CartItem[];
  total: number;
  schema: MobileCheckoutFieldsResponse | null;
  buyerValues: BuyerFieldValues;
  ticketValues: TicketFieldValues;
  errors: Record<string, string>;
  onBuyerChange: (key: string, value: BuyerFieldValues[string]) => void;
  onTicketChange: (
    productId: number,
    attendeeIndex: number,
    key: string,
    value: BuyerFieldValues[string],
  ) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function TicketFieldsStep(props: TicketFieldsStepProps) {
  const colors = useColors();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <CheckoutHeader
        title="Participants"
        onBack={props.onBack}
        expiresAt={props.expiresAt}
      />
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 16 }}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        <SummaryCard itemCount={props.items.length} total={props.total} />
        {props.schema ? (
          <TicketCustomFieldsForm
            cartItems={props.items}
            fieldItems={props.schema.items}
            buyerFields={props.schema.buyerFields}
            buyerValues={props.buyerValues}
            values={props.ticketValues}
            errors={props.errors}
            onBuyerChange={props.onBuyerChange}
            onChange={props.onTicketChange}
          />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
        <TouchableOpacity
          onPress={props.onContinue}
          disabled={!props.schema}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            opacity: props.schema ? 1 : 0.7,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            Continuer vers le paiement
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

export function CheckoutStateScreen({
  title,
  message,
  loading,
  onBack,
  onRetry,
  expiresAt,
}: {
  title: string;
  message: string;
  loading?: boolean;
  onBack: () => void;
  onRetry?: () => void;
  expiresAt?: number | null;
}) {
  const colors = useColors();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <CheckoutHeader
        title={loading ? "Préparation..." : "Erreur"}
        onBack={onBack}
        expiresAt={expiresAt}
      />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <IconSymbol name="xmark.circle.fill" size={56} color={colors.error} />
        )}
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: "700",
            marginTop: 18,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 14,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {message}
        </Text>
        {onRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 20,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

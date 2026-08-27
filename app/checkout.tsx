import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Alert } from "@/lib/platform-alert";
import {
  CheckoutStateScreen,
  ConfirmStep,
  ShippingStep,
  TicketFieldsStep,
} from "@/components/commerce/CheckoutSteps";
import type {
  BuyerFieldValues,
  TicketFieldValues,
} from "@/components/commerce/TicketCustomFieldsForm";
import { useCart } from "@/lib/cart-provider";
import {
  createMobileCheckout,
  getMobileProfile,
  getMobileCheckoutFields,
  type MobileCheckoutFieldsResponse,
  updateMobileProfile,
} from "@/lib/api/mobile";
import {
  buildCheckoutItemInputs,
  buildDefaultCheckoutFieldValues,
  cartNeedsCheckoutFieldSchema,
  validateCheckoutFieldValues,
} from "@/lib/checkout-fields";
import { estimatePointsForPrice, useRewards } from "@/lib/rewards-provider";
import { useAuth } from "@/lib/auth-provider";
import { formatAriary } from "@/lib/format";
import { getBillingInfo, saveBillingInfo } from "@/lib/billing-store";

type CheckoutPhase =
  | "address"
  | "confirm"
  | "ticket_fields"
  | "creating"
  | "error";
type CheckoutErrorSource = "fields" | "order";

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    items,
    total,
    expiresAt: cartExpiresAt,
    ensureCheckoutRequestKey,
  } = useCart();
  const { isAuthenticated, user } = useAuth();
  const {
    currentTier,
    canRedeem,
    programConfig,
    redeemPoints,
    state: rewardsState,
  } = useRewards();

  const rewardEligibleItems = items.filter(
    (item) => item.lamakoRewardsEnabled !== false,
  );
  const allItemsRewardEligible =
    items.length > 0 && rewardEligibleItems.length === items.length;
  const hasPhysicalProducts = items.some((item) => !item.isEvent);
  const hasTicketCheckoutFields = cartNeedsCheckoutFieldSchema(items);
  const canShowRedeem =
    isAuthenticated &&
    programConfig.enabled &&
    allItemsRewardEligible &&
    canRedeem &&
    rewardsState.availablePoints >=
      (programConfig.redemptionTiers[0]?.points ?? Infinity);
  const totalPointsToEarn = rewardEligibleItems.reduce((sum, item) => {
    const price =
      typeof item.price === "string"
        ? Number.parseFloat(item.price) || 0
        : item.price;
    return (
      sum +
      estimatePointsForPrice(
        price * item.quantity,
        currentTier.multiplier,
        programConfig,
      )
    );
  }, 0);

  const [phase, setPhase] = useState<CheckoutPhase>(
    hasPhysicalProducts ? "address" : canShowRedeem ? "confirm" : "creating",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [errorSource, setErrorSource] = useState<CheckoutErrorSource>("order");
  const [fieldsRequestKey, setFieldsRequestKey] = useState(0);
  const [checkoutFieldsLoading, setCheckoutFieldsLoading] = useState(
    items.length > 0 && hasTicketCheckoutFields,
  );
  const [checkoutFields, setCheckoutFields] =
    useState<MobileCheckoutFieldsResponse | null>(null);
  const [buyerFieldValues, setBuyerFieldValues] = useState<BuyerFieldValues>(
    {},
  );
  const [ticketFieldValues, setTicketFieldValues] = useState<TicketFieldValues>(
    {},
  );
  const [ticketFieldErrors, setTicketFieldErrors] = useState<
    Record<string, string>
  >({});
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [billingSaving, setBillingSaving] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const autoCheckoutStartedRef = useRef(false);
  const orderCreationInFlightRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated) return;
    Alert.alert(
      "Connexion requise",
      "Vous devez être connecté pour passer une commande.",
      [
        {
          text: "Se connecter",
          onPress: () =>
            router.replace({
              pathname: "/(auth)/login",
              params: { returnTo: "/checkout" },
            } as any),
        },
      ],
    );
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getBillingInfo().catch(() => null),
      isAuthenticated
        ? getMobileProfile().catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([storedBilling, profile]) => {
        if (!active) return;
        const billing = {
          phone: storedBilling?.phone || profile?.billing.phone || "",
          address: storedBilling?.address || profile?.billing.address_1 || "",
          city: storedBilling?.city || profile?.billing.city || "",
        };
        setShippingPhone((current) => current || billing.phone);
        setShippingAddress((current) => current || billing.address);
        setShippingCity((current) => current || billing.city);
        if (billing.phone || billing.address || billing.city) {
          void saveBillingInfo(billing).catch(() => undefined);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || items.length === 0) {
      setCheckoutFields(null);
      setCheckoutFieldsLoading(false);
      return;
    }

    if (!hasTicketCheckoutFields) {
      setCheckoutFields(null);
      setBuyerFieldValues({});
      setTicketFieldValues({});
      setTicketFieldErrors({});
      setCheckoutFieldsLoading(false);
      return;
    }

    setCheckoutFieldsLoading(true);
    getMobileCheckoutFields(buildCheckoutItemInputs(items))
      .then((schema) => {
        if (!active) return;
        const defaults = buildDefaultCheckoutFieldValues(schema, user);
        setCheckoutFields(schema);
        setBuyerFieldValues(defaults.buyerValues);
        setTicketFieldValues(defaults.ticketValues);
        setTicketFieldErrors({});
      })
      .catch((error) => {
        if (!active) return;
        console.warn("Checkout fields load failed:", error);
        setCheckoutFields(null);
        if (hasTicketCheckoutFields) {
          setErrorSource("fields");
          setErrorMessage(
            "Impossible de charger les champs requis pour ce billet. Veuillez réessayer.",
          );
          setPhase("error");
        }
      })
      .finally(() => {
        if (active) setCheckoutFieldsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fieldsRequestKey, hasTicketCheckoutFields, isAuthenticated, items, user]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      items.length === 0 ||
      phase !== "creating" ||
      autoCheckoutStartedRef.current
    ) {
      return;
    }

    if (hasPhysicalProducts) setPhase("address");
    else if (canShowRedeem) setPhase("confirm");
  }, [
    canShowRedeem,
    hasPhysicalProducts,
    isAuthenticated,
    items.length,
    phase,
  ]);

  useEffect(() => {
    if (allItemsRewardEligible || !appliedCoupon) return;
    setAppliedCoupon(null);
    setAppliedDiscount(0);
    setRedeemError(
      "La réduction LamakoRewards a été retirée car le panier contient un article non éligible.",
    );
  }, [allItemsRewardEligible, appliedCoupon]);

  const redeem = async (points: number) => {
    if (!allItemsRewardEligible || !rewardsState.wpUserId) {
      setRedeemError(
        allItemsRewardEligible
          ? "Impossible de trouver votre compte. Veuillez vous reconnecter."
          : "Les points LamakoRewards ne sont pas disponibles pour ce panier.",
      );
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);
    try {
      const result = await redeemPoints(points, rewardsState.wpUserId);
      if (result.success && result.coupon_code) {
        setAppliedCoupon(result.coupon_code);
        setAppliedDiscount(result.discount_value || 0);
      } else {
        setRedeemError(result.error || "Erreur lors de l'échange de points.");
      }
    } catch {
      setRedeemError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const startOrderCreation = useCallback(async () => {
    if (orderCreationInFlightRef.current) return;
    orderCreationInFlightRef.current = true;
    try {
      if (items.length === 0) throw new Error("Votre panier est vide");
      if (
        items.some(
          (item) =>
            item.salesClosed === true ||
            item.purchasable === false ||
            item.ticketingStatus === "ended",
        )
      ) {
        throw new Error(
          "Un ou plusieurs billets ne sont plus disponibles. Supprimez-les avant de continuer.",
        );
      }
      if (items.some((item) => item.seatLabel)) {
        throw new Error(
          "Les places numérotées doivent être achetées depuis le plan de salle.",
        );
      }

      setPhase("creating");
      const billing: Record<string, string> = {
        first_name: user?.firstName || "Client",
        last_name: user?.lastName || "Mobile",
        email: user?.email || "",
        phone: shippingPhone,
      };
      if (hasPhysicalProducts) {
        billing.address_1 = shippingAddress;
        billing.city = shippingCity;
        billing.country = "MG";
      }

      const result = await createMobileCheckout({
        items: buildCheckoutItemInputs(items, ticketFieldValues, true),
        idempotencyKey: ensureCheckoutRequestKey(),
        billing,
        shipping: hasPhysicalProducts ? billing : undefined,
        buyerFields: buyerFieldValues,
        couponCode: appliedCoupon || undefined,
        reservationExpiresAt: cartExpiresAt
          ? new Date(cartExpiresAt).toISOString()
          : undefined,
        source: items.every((item) => item.isEvent)
          ? "ticket"
          : items.some((item) => item.isEvent)
            ? "mixed_native_cart"
            : "product",
      });

      if (!result.checkoutToken) {
        throw new Error(
          "Impossible de créer la session de paiement. Veuillez réessayer.",
        );
      }

      router.replace({
        pathname: "/payment",
        params: { kind: "checkout", token: result.checkoutToken },
      } as any);
    } catch (error: any) {
      orderCreationInFlightRef.current = false;
      setErrorSource("order");
      if (
        error?.code === "lamako_v2_event_ended" ||
        error?.code === "lamako_v2_ticket_sales_closed"
      ) {
        setErrorMessage(
          "Cet événement est terminé. Le billet n'est plus disponible.",
        );
      } else if (
        error?.code === "lamako_v2_rewards_not_enabled_for_event" ||
        error?.code === "lamako_v2_rewards_not_available_for_cart"
      ) {
        setErrorMessage(
          "Les points LamakoRewards ne sont pas disponibles pour un des articles du panier.",
        );
      } else {
        setErrorMessage(
          error?.message || "Erreur lors de la création de la commande",
        );
      }
      setPhase("error");
    }
  }, [
    appliedCoupon,
    buyerFieldValues,
    ensureCheckoutRequestKey,
    hasPhysicalProducts,
    items,
    router,
    shippingAddress,
    shippingCity,
    shippingPhone,
    ticketFieldValues,
    user,
  ]);

  useEffect(() => {
    if (
      hasPhysicalProducts ||
      canShowRedeem ||
      !isAuthenticated ||
      phase !== "creating" ||
      checkoutFieldsLoading ||
      autoCheckoutStartedRef.current
    ) {
      return;
    }
    autoCheckoutStartedRef.current = true;
    if (checkoutFields?.hasFields) setPhase("ticket_fields");
    else void startOrderCreation();
  }, [
    canShowRedeem,
    checkoutFields,
    checkoutFieldsLoading,
    hasPhysicalProducts,
    isAuthenticated,
    phase,
    startOrderCreation,
  ]);

  const continueAfterPreCheckout = async () => {
    if (checkoutFieldsLoading) return;
    if (hasPhysicalProducts) {
      const billing = {
        phone: shippingPhone.trim(),
        address: shippingAddress.trim(),
        city: shippingCity.trim(),
      };
      setBillingSaving(true);
      await saveBillingInfo(billing).catch(() => undefined);
      setBillingSaving(false);

      if (user) {
        void updateMobileProfile({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email,
          billing: {
            phone: billing.phone,
            address_1: billing.address,
            city: billing.city,
            country: "MG",
          },
        }).catch(() => undefined);
      }
    }
    if (checkoutFields?.hasFields) setPhase("ticket_fields");
    else void startOrderCreation();
  };

  const rewardsProps = {
    pointsToEarn: totalPointsToEarn,
    availablePoints: rewardsState.availablePoints,
    canRedeem,
    allItemsEligible: allItemsRewardEligible,
    isRedeeming,
    redeemError,
    appliedCoupon,
    appliedDiscount,
    tierName: currentTier.name,
    tierMultiplier: currentTier.multiplier,
    onRedeem: redeem,
    onRemoveCoupon: () => {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    },
  };

  if (phase === "address") {
    return (
      <ShippingStep
        {...rewardsProps}
        items={items}
        total={total}
        phone={shippingPhone}
        address={shippingAddress}
        city={shippingCity}
        loading={checkoutFieldsLoading || billingSaving}
        expiresAt={cartExpiresAt}
        onPhoneChange={setShippingPhone}
        onAddressChange={setShippingAddress}
        onCityChange={setShippingCity}
        onContinue={continueAfterPreCheckout}
        onBack={() => router.back()}
      />
    );
  }

  if (phase === "confirm") {
    return (
      <ConfirmStep
        {...rewardsProps}
        itemCount={items.length}
        total={total}
        loading={checkoutFieldsLoading}
        expiresAt={cartExpiresAt}
        onContinue={continueAfterPreCheckout}
        onBack={() => router.back()}
      />
    );
  }

  if (phase === "ticket_fields") {
    return (
      <TicketFieldsStep
        items={items}
        total={total}
        expiresAt={cartExpiresAt}
        schema={checkoutFields}
        buyerValues={buyerFieldValues}
        ticketValues={ticketFieldValues}
        errors={ticketFieldErrors}
        onBuyerChange={(key, value) => {
          setBuyerFieldValues((current) => ({ ...current, [key]: value }));
          setTicketFieldErrors((current) => {
            const next = { ...current };
            delete next[`buyer:${key}`];
            return next;
          });
        }}
        onTicketChange={(productId, attendeeIndex, key, value) => {
          setTicketFieldValues((current) => ({
            ...current,
            [productId]: {
              ...(current[productId] || {}),
              [attendeeIndex]: {
                ...(current[productId]?.[attendeeIndex] || {}),
                [key]: value,
              },
            },
          }));
          setTicketFieldErrors((current) => {
            const next = { ...current };
            delete next[`${productId}:${attendeeIndex}:${key}`];
            return next;
          });
        }}
        onContinue={() => {
          const errors = validateCheckoutFieldValues(
            checkoutFields,
            buyerFieldValues,
            ticketFieldValues,
          );
          setTicketFieldErrors(errors);
          if (Object.keys(errors).length === 0) void startOrderCreation();
        }}
        onBack={() => {
          if (!hasPhysicalProducts && !canShowRedeem) {
            router.back();
            return;
          }
          setPhase(hasPhysicalProducts ? "address" : "confirm");
        }}
      />
    );
  }

  if (phase === "error") {
    return (
      <CheckoutStateScreen
        title="Impossible de préparer la commande"
        message={errorMessage}
        expiresAt={cartExpiresAt}
        onBack={() => router.back()}
        onRetry={() => {
          if (errorSource === "fields") {
            setErrorMessage("");
            setCheckoutFieldsLoading(true);
            setPhase("creating");
            setFieldsRequestKey((current) => current + 1);
            return;
          }
          void startOrderCreation();
        }}
      />
    );
  }

  return (
    <CheckoutStateScreen
      title="Création de votre commande..."
      message={`${items.length} article${items.length > 1 ? "s" : ""} · ${formatAriary(total)}`}
      loading
      expiresAt={cartExpiresAt}
      onBack={() => router.back()}
    />
  );
}

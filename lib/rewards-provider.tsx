import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";
import {
  getMobileReferralCode,
  getMobileRewardsBalance,
  getMobileRewardsConfig,
  getMobileRewardsHistory,
  redeemMobileRewards,
  registerMobileReferral,
  validateMobileReferralCode,
} from "@/lib/api/mobile";

// ===== TIERS (based on Otayo, Live Nation, Ticketmaster benchmarks) =====
// Conservative model: high thresholds, low cashback (2%), experiential rewards
// Earn rate: 1 pt per 1,000 Ar spent
// Average ticket: 50,000 Ar = 50 pts per event
// Fan: 0 (free join)
// Silver: 500 pts (~500,000 Ar = 3-5 events) - regular attendees
// Gold: 2,000 pts (~2,000,000 Ar = 10-15 events) - loyal fans
// Platinum: 5,000 pts (~5,000,000 Ar = 30+ events) - superfans
// Diamond: 10,000 pts (~10,000,000 Ar = top 1%) - elite status

export type RewardTier = "fan" | "silver" | "gold" | "platinum" | "diamond";

export interface TierInfo {
  id: RewardTier;
  name: string;
  minPoints: number;
  color: string;
  icon: string;
  benefits: string[];
  discountPercent: number;
  multiplier: number; // points multiplier for this tier
}

export const TIERS: TierInfo[] = [
  {
    id: "fan",
    name: "Fan",
    minPoints: 0,
    color: "#8B6914",
    icon: "🎵",
    discountPercent: 0,
    multiplier: 1,
    benefits: [
      "Accès au programme de fidélité",
      "1 point par 1 000 Ar dépensé",
      "Historique des points et transactions",
      "Code de parrainage personnel",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    minPoints: 500,
    color: "#C0C0C0",
    icon: "⭐",
    discountPercent: 0,
    multiplier: 1,
    benefits: [
      "Réductions membres exclusives",
      "Accès prioritaire aux préventes",
      "Offres spéciales par notification",
      "Support prioritaire WhatsApp",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    minPoints: 2000,
    color: "#FFD700",
    icon: "🌟",
    discountPercent: 0,
    multiplier: 1.25,
    benefits: [
      "x1.25 points sur chaque achat",
      "Invitations aux événements exclusifs",
      "Early access aux nouvelles ventes",
      "Cadeaux surprises aux événements",
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    minPoints: 5000,
    color: "#E5E4E2",
    icon: "💎",
    discountPercent: 0,
    multiplier: 1.5,
    benefits: [
      "x1.5 points sur chaque achat",
      "Surclassement de billets",
      "Accès VIP aux événements",
      "Support dédié",
    ],
  },
  {
    id: "diamond",
    name: "Diamond",
    minPoints: 10000,
    color: "#B9F2FF",
    icon: "💠",
    discountPercent: 0,
    multiplier: 2,
    benefits: [
      "x2 points sur chaque achat",
      "Accès backstage",
      "Meet & greet artistes",
      "Conciergerie événementielle",
      "Surclassement automatique",
      "Invitations privées",
    ],
  },
];

// ===== EARN RULES =====
export const EARN_RULES = {
  purchaseRate: 1, // 1 point per 1000 Ar spent
  purchaseUnit: 1000, // Ar per point
  registrationBonus: 100, // like Otayo
  profileCompleteBonus: 100, // complete profile
  loginBonus: 2, // per day (max 1x/day) - conservative
  firstPurchaseBonus: 200, // bonus on first purchase (like Otayo)
  eventAttendanceBonus: 10, // scan at entry
  reviewBonus: 15, // leave a review
  referralBonus: 75, // when referee makes first purchase
  refereeBonus: 25, // bonus for the new user who used a referral code
  birthdayBonus: 200, // annual birthday bonus (like Otayo)
  shareBonus: 20, // share event on social media (like Otayo)
  newsletterBonus: 100, // subscribe to newsletter
};

// ===== REDEMPTION RULES =====
// Offline fallback only. The server endpoint /rewards/config is authoritative.
export const REDEMPTION_MIN_POINTS_LIFETIME = 750; // 750 pts = 750 000 Ar spent
export const REDEMPTION_TIERS = [
  { points: 1000, value: 20000, label: "1 000 pts = 20 000 Ar" },
  { points: 2000, value: 40000, label: "2 000 pts = 40 000 Ar" },
];

export interface RewardsProgramConfig {
  enabled: boolean;
  minimumRedeemPoints: number;
  earnPoints: number;
  earnAmountAriary: number;
  redemptionTiers: Array<{ points: number; value: number; label: string }>;
}

export const DEFAULT_REWARDS_PROGRAM_CONFIG: RewardsProgramConfig = {
  enabled: true,
  minimumRedeemPoints: REDEMPTION_MIN_POINTS_LIFETIME,
  earnPoints: EARN_RULES.purchaseRate,
  earnAmountAriary: EARN_RULES.purchaseUnit,
  redemptionTiers: REDEMPTION_TIERS,
};

// ===== HISTORY =====
export interface RewardTransaction {
  id: string;
  type: "earn" | "redeem";
  amount: number;
  reference: string;
  orderId?: number;
  description: string;
  date: string; // ISO string
}

// ===== STATE =====
export interface RewardsState {
  wpUserId: number | null;
  totalPoints: number;
  availablePoints: number;
  lifetimePoints: number;
  tier: RewardTier;
  nextTier: string;
  pointsToNextTier: number;
  history: RewardTransaction[];
  referralCode: string;
  lastSynced: string | null;
}

const DEFAULT_STATE: RewardsState = {
  wpUserId: null,
  totalPoints: 0,
  availablePoints: 0,
  lifetimePoints: 0,
  tier: "fan",
  nextTier: "Silver",
  pointsToNextTier: 500,
  history: [],
  referralCode: "",
  lastSynced: null,
};

// ===== CONTEXT =====
interface RewardsContextType {
  state: RewardsState;
  programConfig: RewardsProgramConfig;
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  progressToNextTier: number; // 0-1
  pointsToNextTier: number;
  canRedeem: boolean;
  pointsUntilRedemption: number;
  syncRewards: () => Promise<void>;
  getDiscountValue: (points: number) => number;
  getBestRedemption: (
    points: number,
  ) => { points: number; value: number } | null;
  redeemPoints: (points: number, wpUserId: number) => Promise<RedeemResult>;
  isLoading: boolean;
  isSyncing: boolean;
}

export interface RedeemResult {
  success: boolean;
  coupon_code?: string;
  discount_value?: number;
  points_deducted?: number;
  new_balance?: number;
  error?: string;
}

const RewardsContext = createContext<RewardsContextType | null>(null);

const STORAGE_KEY = "@lamako_rewards";

function getTierForPoints(lifetimePoints: number): RewardTier {
  if (lifetimePoints >= 10000) return "diamond";
  if (lifetimePoints >= 5000) return "platinum";
  if (lifetimePoints >= 2000) return "gold";
  if (lifetimePoints >= 500) return "silver";
  return "fan";
}

function generateReferralCode(userId?: string): string {
  const base = userId ? userId.slice(0, 4) : "LMK";
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TBL-${base}${random}`;
}

// ===== REFERRAL API FUNCTIONS =====
export async function validateReferralCode(
  code: string,
): Promise<{ valid: boolean; referrer_name?: string; bonus?: number }> {
  try {
    const result = await validateMobileReferralCode(code);
    return {
      valid: result.valid,
      referrer_name: result.referrerName,
      bonus: result.bonus,
    };
  } catch (e) {
    console.warn("Failed to validate referral code:", e);
    return { valid: false };
  }
}

export async function registerReferral(
  refereeUserId: number,
  referrerCode: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await registerMobileReferral(referrerCode);
    return { success: result.success, error: result.error };
  } catch (e) {
    console.warn("Failed to register referral:", e);
    return { success: false, error: "Erreur réseau" };
  }
}

/**
 * Redeem points for a WooCommerce coupon code.
 * Calls the /redeem endpoint which deducts points and creates a one-time coupon.
 */
export async function redeemPointsApi(
  points: number,
  wpUserId: number,
): Promise<RedeemResult> {
  try {
    const data = await redeemMobileRewards(points);
    return {
      success: data.success,
      coupon_code: data.couponCode,
      discount_value: data.discountValue,
      points_deducted: data.pointsDeducted,
      new_balance: data.newBalance,
    };
  } catch (e: any) {
    console.warn("Failed to redeem points:", e);
    return { success: false, error: "Erreur réseau. Veuillez réessayer." };
  }
}

export async function fetchReferralCode(
  wpUserId: number,
): Promise<{ code: string; referral_count: number } | null> {
  try {
    const result = await getMobileReferralCode();
    return { code: result.code, referral_count: result.referralCount };
  } catch (e) {
    console.warn("Failed to fetch referral code:", e);
    return null;
  }
}

// ===== API FUNCTIONS =====
async function fetchBalance(wpUserId: number): Promise<{
  balance: number;
  total_earned: number;
  tier: string;
  next_tier: string;
  points_to_next_tier: number;
} | null> {
  try {
    const balance = await getMobileRewardsBalance();
    return {
      balance: balance.balance,
      total_earned: balance.totalEarned,
      tier: balance.tier,
      next_tier: balance.nextTier,
      points_to_next_tier: balance.pointsToNextTier,
    };
  } catch (e) {
    console.warn("Failed to fetch rewards balance:", e);
    return null;
  }
}

function normalizeRewardDescription(item: {
  type: "earn" | "redeem";
  amount: number;
  reference?: string;
  orderId?: number;
  description?: string;
}): string {
  const raw = (item.description || "").replace(/%[a-zA-Z_]+%/g, "").trim();
  const ref = item.reference || "";
  const orderLabel = item.orderId
    ? `commande #${item.orderId}`
    : ref.toLowerCase().includes("commande")
      ? ref.toLowerCase()
      : "";

  if (
    /lamako mobile v2 redemption|redemption|redeem/i.test(raw) ||
    /redemption|redeem/i.test(ref)
  ) {
    const match = raw.match(/(\d+)\s*pts?/i);
    return match
      ? `Réduction LamakoRewards: ${Number(match[1]).toLocaleString("fr-FR")} points utilisés`
      : "Points utilisés pour une réduction LamakoRewards";
  }

  if (/points for order|product purchase|purchase|order/i.test(raw)) {
    return orderLabel
      ? `Achat ${orderLabel}: +${Math.abs(item.amount).toLocaleString("fr-FR")} pts`
      : `Achat validé: +${Math.abs(item.amount).toLocaleString("fr-FR")} pts`;
  }

  if (raw) return raw;
  return item.type === "earn" ? "Points gagnés" : "Points échangés";
}

async function fetchHistory(
  wpUserId: number,
  limit = 50,
): Promise<RewardTransaction[]> {
  try {
    const history = await getMobileRewardsHistory(limit);
    return history.map((item) => ({
      id: item.id.toString(),
      type: item.type,
      amount: Math.abs(item.amount),
      reference: item.reference,
      orderId: item.orderId,
      description: normalizeRewardDescription(item),
      date: item.date,
    }));
  } catch (e) {
    console.warn("Failed to fetch rewards history:", e);
    return [];
  }
}

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<RewardsState>(DEFAULT_STATE);
  const [programConfig, setProgramConfig] = useState<RewardsProgramConfig>(
    DEFAULT_REWARDS_PROGRAM_CONFIG,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const stateRef = useRef(state);
  const syncingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;
    getMobileRewardsConfig()
      .then((config) => {
        const options = config.program.redemption_options
          .filter((option) => option.points > 0 && option.amount_ariary > 0)
          .sort((a, b) => a.points - b.points)
          .map((option) => ({
            points: option.points,
            value: option.amount_ariary,
            label: `${option.points.toLocaleString("fr-FR")} pts = ${option.amount_ariary.toLocaleString("fr-FR")} Ar`,
          }));
        if (!active) return;
        setProgramConfig({
          enabled: config.program.enabled,
          minimumRedeemPoints:
            config.program.minimum_redeem_points ||
            DEFAULT_REWARDS_PROGRAM_CONFIG.minimumRedeemPoints,
          earnPoints:
            config.program.earn_rate.points ||
            DEFAULT_REWARDS_PROGRAM_CONFIG.earnPoints,
          earnAmountAriary:
            config.program.earn_rate.amount_ariary ||
            DEFAULT_REWARDS_PROGRAM_CONFIG.earnAmountAriary,
          redemptionTiers:
            options.length > 0
              ? options
              : DEFAULT_REWARDS_PROGRAM_CONFIG.redemptionTiers,
        });
      })
      .catch((error) => {
        console.warn("Failed to fetch rewards program config:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load cached state from storage
  useEffect(() => {
    const loadState = async () => {
      try {
        const key = `${STORAGE_KEY}_${user?.id || "guest"}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as RewardsState;
          setState(parsed);
        } else {
          const initial: RewardsState = {
            ...DEFAULT_STATE,
            referralCode: generateReferralCode(user?.id?.toString()),
          };
          setState(initial);
        }
      } catch (e) {
        console.warn("Failed to load rewards state:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, [user?.id]);

  // Save state to storage
  const saveState = useCallback(
    async (newState: RewardsState) => {
      try {
        const key = `${STORAGE_KEY}_${user?.id || "guest"}`;
        await AsyncStorage.setItem(key, JSON.stringify(newState));
      } catch (e) {
        console.warn("Failed to save rewards state:", e);
      }
    },
    [user?.id],
  );

  // Sync with server API
  const syncRewards = useCallback(async () => {
    if (!user?.id || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const wpUserId = user.id;

      const [balanceData, history, referral] = await Promise.all([
        fetchBalance(wpUserId),
        fetchHistory(wpUserId),
        fetchReferralCode(wpUserId),
      ]);
      if (!balanceData) {
        return;
      }

      // Update state with server data
      const tier = getTierForPoints(balanceData.total_earned);
      const currentState = stateRef.current;
      const newState: RewardsState = {
        ...currentState,
        wpUserId,
        totalPoints: balanceData.balance,
        availablePoints: balanceData.balance,
        lifetimePoints: balanceData.total_earned,
        tier,
        nextTier: balanceData.next_tier,
        pointsToNextTier: balanceData.points_to_next_tier,
        history,
        lastSynced: new Date().toISOString(),
        referralCode:
          referral?.code ||
          currentState.referralCode ||
          generateReferralCode(user?.id?.toString()),
      };

      setState(newState);
      await saveState(newState);
    } catch (e) {
      console.warn("Failed to sync rewards:", e);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [user?.id, saveState]);

  // Refresh the account ledger after the cached state has been restored.
  useEffect(() => {
    if (isAuthenticated && user?.id && !isLoading) {
      void syncRewards();
    }
  }, [isAuthenticated, user?.id, isLoading, syncRewards]);

  // The server program configuration controls redemption eligibility.
  const canRedeem =
    programConfig.enabled &&
    state.lifetimePoints >= programConfig.minimumRedeemPoints;
  const pointsUntilRedemption = canRedeem
    ? 0
    : Math.max(0, programConfig.minimumRedeemPoints - state.lifetimePoints);

  // Get the best redemption tier for a given number of points
  const getBestRedemption = useCallback(
    (points: number): { points: number; value: number } | null => {
      if (
        !programConfig.enabled ||
        state.lifetimePoints < programConfig.minimumRedeemPoints
      ) {
        return null;
      }
      // Find the highest redemption tier the user can afford
      const affordable = programConfig.redemptionTiers.filter(
        (tier) => tier.points <= points,
      );
      if (affordable.length === 0) return null;
      return affordable[affordable.length - 1];
    },
    [programConfig, state.lifetimePoints],
  );

  // Legacy discount calculation (backward compat)
  const getDiscountValue = useCallback(
    (points: number): number => {
      const best = getBestRedemption(points);
      return best ? best.value : 0;
    },
    [getBestRedemption],
  );

  // Computed values
  const currentTier = TIERS.find((t) => t.id === state.tier) || TIERS[0];
  const currentTierIndex = TIERS.findIndex((t) => t.id === state.tier);
  const nextTierInfo =
    currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;

  const progressToNextTier = nextTierInfo
    ? Math.min(
        1,
        (state.lifetimePoints - currentTier.minPoints) /
          (nextTierInfo.minPoints - currentTier.minPoints),
      )
    : 1;

  const pointsToNextTier = nextTierInfo
    ? Math.max(0, nextTierInfo.minPoints - state.lifetimePoints)
    : 0;

  // Redeem points - calls API and updates local state
  const redeemPoints = useCallback(
    async (points: number, wpUserId: number): Promise<RedeemResult> => {
      const result = await redeemPointsApi(points, wpUserId);
      if (result.success && result.new_balance !== undefined) {
        // Update local state with new balance
        const newState: RewardsState = {
          ...state,
          totalPoints: result.new_balance,
          availablePoints: result.new_balance,
          history: [
            {
              id: Date.now().toString(),
              type: "redeem",
              amount: result.points_deducted || points,
              reference: "redemption",
              description: `Échange ${points} pts → ${result.coupon_code}`,
              date: new Date().toISOString(),
            },
            ...state.history,
          ],
        };
        setState(newState);
        await saveState(newState);
      }
      return result;
    },
    [state, saveState],
  );

  return (
    <RewardsContext.Provider
      value={{
        state,
        programConfig,
        currentTier,
        nextTier: nextTierInfo,
        progressToNextTier,
        pointsToNextTier,
        canRedeem,
        pointsUntilRedemption,
        syncRewards,
        getDiscountValue,
        getBestRedemption,
        redeemPoints,
        isLoading,
        isSyncing,
      }}
    >
      {children}
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards must be used within RewardsProvider");
  return ctx;
}

/**
 * Estimate points earned for a given price in Ariary.
 * Uses the user's current tier multiplier if available.
 * Can be used outside of RewardsProvider (returns base points only).
 */
export function estimatePointsForPrice(
  priceAr: number,
  multiplier: number = 1,
  config: Pick<
    RewardsProgramConfig,
    "enabled" | "earnPoints" | "earnAmountAriary"
  > = DEFAULT_REWARDS_PROGRAM_CONFIG,
): number {
  if (
    !config.enabled ||
    config.earnAmountAriary <= 0 ||
    config.earnPoints <= 0
  ) {
    return 0;
  }
  const baseUnits = Math.floor(priceAr / config.earnAmountAriary);
  return Math.floor(baseUnits * config.earnPoints * multiplier);
}

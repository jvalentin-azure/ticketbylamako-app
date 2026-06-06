import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";
import {
  getMobileReferralCode,
  getMobileRewardsConfig,
  getMobileRewardsBalance,
  getMobileRewardsHistory,
  type MobileRewardsConfig,
  redeemMobileRewards,
  registerMobileReferral,
  validateMobileReferralCode,
} from "@/lib/api/mobile";

// ===== TIERS (based on Otayo, Live Nation, Ticketmaster benchmarks) =====
// Conservative model: high thresholds, controlled reductions, experiential rewards
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
// Official fallback only. Runtime values are loaded from the WordPress Rewards config.
export const REDEMPTION_MIN_POINTS_LIFETIME = 750;
export const REDEMPTION_TIERS = [
  { points: 1000, value: 20000, label: "1 000 pts = 20 000 Ar" },
  { points: 2000, value: 40000, label: "2 000 pts = 40 000 Ar" },
];

export interface RedemptionTier {
  points: number;
  value: number;
  label: string;
}

export interface RewardsRuntimeConfig {
  enabled: boolean;
  minimumRedeemPoints: number;
  redemptionTiers: RedemptionTier[];
  earnRules: typeof EARN_RULES;
  tiers: TierInfo[];
  copy: {
    earnMessage: string;
    redeemMessage: string;
    minimumRedeemMessage: string;
    pointsToRedeemMessage: string;
  };
  popup: {
    mobileEnabled: boolean;
    mobileAudience: string;
    mobileDelayMs: number;
    mobileFrequencyDays: number;
    mobileMaxImpressions: number;
    mobileCtaRoute: string;
  };
}

export const DEFAULT_REWARDS_RUNTIME_CONFIG: RewardsRuntimeConfig = {
  enabled: true,
  minimumRedeemPoints: REDEMPTION_MIN_POINTS_LIFETIME,
  redemptionTiers: REDEMPTION_TIERS,
  earnRules: EARN_RULES,
  tiers: TIERS,
  copy: {
    earnMessage: "Gagnez des points sur vos achats eligibles.",
    redeemMessage: "Utilisez vos points sur les evenements et offres participants Lamako Rewards.",
    minimumRedeemMessage: "Les reductions Rewards sont debloquees a partir de 750 points.",
    pointsToRedeemMessage: "Plus que {{points_to_redeem}} points pour debloquer vos reductions Rewards.",
  },
  popup: {
    mobileEnabled: true,
    mobileAudience: "guests",
    mobileDelayMs: 12000,
    mobileFrequencyDays: 7,
    mobileMaxImpressions: 3,
    mobileCtaRoute: "/rewards",
  },
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
  config: RewardsRuntimeConfig;
  tiers: TierInfo[];
  redemptionTiers: RedemptionTier[];
  minimumRedeemPoints: number;
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  progressToNextTier: number; // 0-1
  pointsToNextTier: number;
  canRedeem: boolean; // true only when lifetime and available balance meet config minimum
  pointsUntilRedemption: number; // 0 if can redeem, otherwise pts needed to reach 750
  syncRewards: () => Promise<void>;
  syncRewardsConfig: () => Promise<void>;
  getDiscountValue: (points: number) => number;
  getBestRedemption: (points: number) => { points: number; value: number } | null;
  redeemPoints: (points: number, wpUserId: number) => Promise<RedeemResult>;
  isLoading: boolean;
  isSyncing: boolean;
  isConfigReady: boolean;
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
const CONFIG_STORAGE_KEY = "@lamako_rewards_config";

function getTierForPoints(lifetimePoints: number): RewardTier {
  if (lifetimePoints >= 10000) return "diamond";
  if (lifetimePoints >= 5000) return "platinum";
  if (lifetimePoints >= 2000) return "gold";
  if (lifetimePoints >= 500) return "silver";
  return "fan";
}

function normalizeTierId(id: string): RewardTier {
  return ["fan", "silver", "gold", "platinum", "diamond"].includes(id) ? (id as RewardTier) : "fan";
}

function iconForTier(id: RewardTier): string {
  return TIERS.find(t => t.id === id)?.icon || "★";
}

function colorForTier(id: RewardTier): string {
  return TIERS.find(t => t.id === id)?.color || "#8B6914";
}

function runtimeConfigFromApi(apiConfig: MobileRewardsConfig): RewardsRuntimeConfig {
  const program = apiConfig.program || {
    signup_bonus_points: EARN_RULES.registrationBonus,
    earn_rate: { points: EARN_RULES.purchaseRate, amount_ariary: EARN_RULES.purchaseUnit },
    minimum_redeem_points: REDEMPTION_MIN_POINTS_LIFETIME,
    redemption_options: REDEMPTION_TIERS.map(tier => ({ points: tier.points, amount_ariary: tier.value })),
    referral: { referrer_points: EARN_RULES.referralBonus, referred_points: EARN_RULES.refereeBonus },
    tiers: TIERS.map(tier => ({ id: tier.id, name: tier.name, min_points: tier.minPoints, multiplier: tier.multiplier, benefits: tier.benefits })),
  };
  const earningActions = (program as any).earning_actions || {};
  const minimumRedeemPoints = Number(program.minimum_redeem_points || REDEMPTION_MIN_POINTS_LIFETIME);
  const redemptionTiers = (program.redemption_options || [])
    .map(option => {
      const points = Number(option.points || 0);
      const value = Number(option.amount_ariary || 0);
      return points > 0 && value > 0
        ? { points, value, label: `${points.toLocaleString("fr-FR")} pts = ${value.toLocaleString("fr-FR")} Ar` }
        : null;
    })
    .filter(Boolean) as RedemptionTier[];

  const tiers = (program.tiers || [])
    .map(tier => {
      const id = normalizeTierId(tier.id);
      return {
        id,
        name: tier.name || TIERS.find(t => t.id === id)?.name || "Fan",
        minPoints: Number(tier.min_points || 0),
        color: colorForTier(id),
        icon: iconForTier(id),
        discountPercent: 0,
        multiplier: Number(tier.multiplier || 1),
        benefits: Array.isArray(tier.benefits) && tier.benefits.length > 0
          ? tier.benefits
          : TIERS.find(t => t.id === id)?.benefits || [],
      };
    })
    .filter(tier => tier.id) as TierInfo[];

  return {
    enabled: program.enabled ?? true,
    minimumRedeemPoints,
    redemptionTiers: redemptionTiers.length > 0 ? redemptionTiers : REDEMPTION_TIERS,
    tiers: tiers.length > 0 ? tiers : TIERS,
    earnRules: {
      purchaseRate: Number(program.earn_rate?.points || EARN_RULES.purchaseRate),
      purchaseUnit: Number(program.earn_rate?.amount_ariary || EARN_RULES.purchaseUnit),
      registrationBonus: Number(program.signup_bonus_points || EARN_RULES.registrationBonus),
      profileCompleteBonus: Number(earningActions.profile_completed_points || EARN_RULES.profileCompleteBonus),
      loginBonus: Number(earningActions.daily_login_points || EARN_RULES.loginBonus),
      firstPurchaseBonus: Number(earningActions.first_purchase_points || EARN_RULES.firstPurchaseBonus),
      eventAttendanceBonus: Number(earningActions.event_attendance_points || EARN_RULES.eventAttendanceBonus),
      reviewBonus: Number(earningActions.review_points || EARN_RULES.reviewBonus),
      referralBonus: Number(program.referral?.referrer_points || EARN_RULES.referralBonus),
      refereeBonus: Number(program.referral?.referred_points || EARN_RULES.refereeBonus),
      birthdayBonus: Number(earningActions.birthday_points || EARN_RULES.birthdayBonus),
      shareBonus: Number(earningActions.social_share_points || EARN_RULES.shareBonus),
      newsletterBonus: Number(earningActions.newsletter_points || EARN_RULES.newsletterBonus),
    },
    copy: {
      earnMessage: apiConfig.copy?.earn_message || DEFAULT_REWARDS_RUNTIME_CONFIG.copy.earnMessage,
      redeemMessage: apiConfig.copy?.redeem_message || DEFAULT_REWARDS_RUNTIME_CONFIG.copy.redeemMessage,
      minimumRedeemMessage: apiConfig.copy?.minimum_redeem_message || DEFAULT_REWARDS_RUNTIME_CONFIG.copy.minimumRedeemMessage,
      pointsToRedeemMessage: apiConfig.copy?.points_to_redeem_message || DEFAULT_REWARDS_RUNTIME_CONFIG.copy.pointsToRedeemMessage,
    },
    popup: {
      mobileEnabled: apiConfig.popup?.mobile?.enabled ?? DEFAULT_REWARDS_RUNTIME_CONFIG.popup.mobileEnabled,
      mobileAudience: apiConfig.popup?.mobile?.audience || DEFAULT_REWARDS_RUNTIME_CONFIG.popup.mobileAudience,
      mobileDelayMs: Number(apiConfig.popup?.mobile?.delay_seconds || 12) * 1000,
      mobileFrequencyDays: Number(apiConfig.popup?.mobile?.frequency_days || 7),
      mobileMaxImpressions: Number(apiConfig.popup?.mobile?.max_impressions_per_user || 3),
      mobileCtaRoute: apiConfig.popup?.mobile?.cta_route || DEFAULT_REWARDS_RUNTIME_CONFIG.popup.mobileCtaRoute,
    },
  };
}

function generateReferralCode(userId?: string): string {
  const base = userId ? userId.slice(0, 4) : "LMK";
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TBL-${base}${random}`;
}

// ===== REFERRAL API FUNCTIONS =====
export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrer_name?: string; bonus?: number }> {
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

export async function registerReferral(refereeUserId: number, referrerCode: string): Promise<{ success: boolean; error?: string }> {
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
export async function redeemPointsApi(points: number, wpUserId: number): Promise<RedeemResult> {
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

export async function fetchReferralCode(wpUserId: number): Promise<{ code: string; referral_count: number } | null> {
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
  const orderLabel = item.orderId ? `commande #${item.orderId}` : ref.toLowerCase().includes("commande") ? ref.toLowerCase() : "";

  if (/lamako mobile v2 redemption|redemption|redeem/i.test(raw) || /redemption|redeem/i.test(ref)) {
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

async function fetchHistory(wpUserId: number, limit = 20): Promise<RewardTransaction[]> {
  try {
    const history = await getMobileRewardsHistory(limit);
    return history.map(item => ({
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
  const [config, setConfig] = useState<RewardsRuntimeConfig>(DEFAULT_REWARDS_RUNTIME_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfigReady, setIsConfigReady] = useState(false);

  const syncRewardsConfig = useCallback(async () => {
    try {
      const remoteConfig = await getMobileRewardsConfig();
      const runtimeConfig = runtimeConfigFromApi(remoteConfig);
      setConfig(runtimeConfig);
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(runtimeConfig));
    } catch (e) {
      console.warn("Failed to fetch rewards config:", e);
    } finally {
      setIsConfigReady(true);
    }
  }, []);

  // Load cached state from storage
  useEffect(() => {
    const loadState = async () => {
      try {
        const storedConfig = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
          setConfig({ ...DEFAULT_REWARDS_RUNTIME_CONFIG, ...JSON.parse(storedConfig) });
        }

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

  useEffect(() => {
    syncRewardsConfig();
  }, [syncRewardsConfig]);

  // Auto-sync when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && !isLoading) {
      syncRewards();
    }
  }, [isAuthenticated, user?.id, isLoading]);

  // Save state to storage
  const saveState = useCallback(async (newState: RewardsState) => {
    try {
      const key = `${STORAGE_KEY}_${user?.id || "guest"}`;
      await AsyncStorage.setItem(key, JSON.stringify(newState));
    } catch (e) {
      console.warn("Failed to save rewards state:", e);
    }
  }, [user?.id]);

  // Sync with server API
  const syncRewards = useCallback(async () => {
    if (!user?.id || isSyncing) return;
    setIsSyncing(true);

    try {
      const wpUserId = user.id;

      // Fetch balance from server
      const balanceData = await fetchBalance(wpUserId);
      if (!balanceData) {
        setIsSyncing(false);
        return;
      }

      // Fetch history
      const history = await fetchHistory(wpUserId);
      const referral = await fetchReferralCode(wpUserId);

      // Update state with server data
      const tier = normalizeTierId(balanceData.tier || getTierForPoints(balanceData.total_earned));
      const newState: RewardsState = {
        ...state,
        wpUserId,
        totalPoints: balanceData.balance,
        availablePoints: balanceData.balance,
        lifetimePoints: balanceData.total_earned,
        tier,
        nextTier: balanceData.next_tier,
        pointsToNextTier: balanceData.points_to_next_tier,
        history: history.length > 0 ? history : state.history,
        lastSynced: new Date().toISOString(),
        referralCode: referral?.code || state.referralCode || generateReferralCode(user?.id?.toString()),
      };

      setState(newState);
      await saveState(newState);
    } catch (e) {
      console.warn("Failed to sync rewards:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id, state, isSyncing, saveState]);

  // Check if user can redeem: lifetime threshold and available balance must both meet the configured minimum.
  const minimumRedeemPoints = config.minimumRedeemPoints;
  const canRedeem = config.enabled && state.lifetimePoints >= minimumRedeemPoints && state.availablePoints >= minimumRedeemPoints;
  const pointsUntilRedemption = canRedeem ? 0 : Math.max(0, minimumRedeemPoints - state.availablePoints);

  // Get the best redemption tier for a given number of points
  const getBestRedemption = useCallback((points: number): { points: number; value: number } | null => {
    if (state.lifetimePoints < minimumRedeemPoints || state.availablePoints < minimumRedeemPoints) return null;
    // Find the highest redemption tier the user can afford
    const affordable = config.redemptionTiers.filter(t => t.points <= points);
    if (affordable.length === 0) return null;
    return affordable[affordable.length - 1];
  }, [config.redemptionTiers, minimumRedeemPoints, state.availablePoints, state.lifetimePoints]);

  // Legacy discount calculation (backward compat)
  const getDiscountValue = useCallback((points: number): number => {
    const best = getBestRedemption(points);
    return best ? best.value : 0;
  }, [getBestRedemption]);

  // Computed values
  const tiers = config.tiers;
  const currentTier = tiers.find(t => t.id === state.tier) || tiers[0] || TIERS[0];
  const currentTierIndex = tiers.findIndex(t => t.id === state.tier);
  const nextTierInfo = currentTierIndex >= 0 && currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  
  const progressToNextTier = nextTierInfo
    ? Math.min(1, (state.lifetimePoints - currentTier.minPoints) / (nextTierInfo.minPoints - currentTier.minPoints))
    : 1;
  
  const pointsToNextTier = nextTierInfo
    ? Math.max(0, nextTierInfo.minPoints - state.lifetimePoints)
    : 0;

  // Redeem points - calls API and updates local state
  const redeemPoints = useCallback(async (points: number, wpUserId: number): Promise<RedeemResult> => {
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
  }, [state, saveState]);

  return (
    <RewardsContext.Provider
      value={{
        state,
        config,
        tiers,
        redemptionTiers: config.redemptionTiers,
        minimumRedeemPoints,
        currentTier,
        nextTier: nextTierInfo,
        progressToNextTier,
        pointsToNextTier,
        canRedeem,
        pointsUntilRedemption,
        syncRewards,
        syncRewardsConfig,
        getDiscountValue,
        getBestRedemption,
        redeemPoints,
        isLoading,
        isSyncing,
        isConfigReady,
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
export function estimatePointsForPrice(priceAr: number, multiplier: number = 1): number {
  const base = Math.floor(priceAr / EARN_RULES.purchaseUnit);
  return Math.floor(base * multiplier);
}

export function estimatePointsForPriceWithConfig(
  priceAr: number,
  config: RewardsRuntimeConfig,
  multiplier: number = 1
): number {
  if (!config.enabled) return 0;
  const unit = Math.max(1, Number(config.earnRules.purchaseUnit || EARN_RULES.purchaseUnit));
  const rate = Math.max(0, Number(config.earnRules.purchaseRate || EARN_RULES.purchaseRate));
  const base = Math.floor(priceAr / unit) * rate;
  return Math.floor(base * multiplier);
}

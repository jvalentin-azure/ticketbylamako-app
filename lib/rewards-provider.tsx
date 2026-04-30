import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";
import Constants from "expo-constants";

// ===== API CONFIGURATION =====
const API_BASE = "https://www.ticketbylamako.com/wp-json/lamako-rewards/v1";
// API key from environment variable (set via EXPO_PUBLIC_REWARDS_API_KEY)
const API_KEY = process.env.EXPO_PUBLIC_REWARDS_API_KEY || (Constants.expoConfig?.extra as any)?.rewardsApiKey || "LR_2024_SECURE_KEY_TBL";

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
      "25% de points bonus sur chaque achat",
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
      "50% de points bonus sur chaque achat",
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
// Fixed rate: 500 pts = 10,000 Ar (20 Ar/pt = 2% cashback equivalent)
// This is conservative and industry-standard (AMC = 2%, airlines = 1-2%)
// IMPORTANT: Redemption is available after 750 000 Ar spent (= 750 lifetime pts)
// This is independent of tier level - users accumulate points but can only redeem after reaching 750 pts
export const REDEMPTION_MIN_POINTS_LIFETIME = 750; // 750 pts = 750 000 Ar spent
export const REDEMPTION_TIERS = [
  { points: 500, value: 10000, label: "500 pts = 10 000 Ar" },
  { points: 1000, value: 20000, label: "1 000 pts = 20 000 Ar" },
  { points: 2000, value: 40000, label: "2 000 pts = 40 000 Ar" },
  { points: 5000, value: 100000, label: "5 000 pts = 100 000 Ar" },
];

// ===== HISTORY =====
export interface RewardTransaction {
  id: string;
  type: "earn" | "redeem";
  amount: number;
  reference: string;
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
  currentTier: TierInfo;
  nextTier: TierInfo | null;
  progressToNextTier: number; // 0-1
  pointsToNextTier: number;
  canRedeem: boolean; // true only if lifetimePoints >= 750 (= 750 000 Ar spent)
  pointsUntilRedemption: number; // 0 if can redeem, otherwise pts needed to reach 750
  syncRewards: () => Promise<void>;
  getDiscountValue: (points: number) => number;
  getBestRedemption: (points: number) => { points: number; value: number } | null;
  isLoading: boolean;
  isSyncing: boolean;
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
export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrer_name?: string; bonus?: number }> {
  try {
    const res = await fetch(`${API_BASE}/referral/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, api_key: API_KEY }),
    });
    if (!res.ok) return { valid: false };
    return await res.json();
  } catch (e) {
    console.warn("Failed to validate referral code:", e);
    return { valid: false };
  }
}

export async function registerReferral(refereeUserId: number, referrerCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/referral/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referee_user_id: refereeUserId, referrer_code: referrerCode, api_key: API_KEY }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.message || "Erreur" };
    return { success: true };
  } catch (e) {
    console.warn("Failed to register referral:", e);
    return { success: false, error: "Erreur réseau" };
  }
}

export async function fetchReferralCode(wpUserId: number): Promise<{ code: string; referral_count: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/referral/code?user_id=${wpUserId}&api_key=${API_KEY}`);
    if (!res.ok) return null;
    return await res.json();
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
    const res = await fetch(
      `${API_BASE}/balance?user_id=${wpUserId}&api_key=${API_KEY}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Failed to fetch rewards balance:", e);
    return null;
  }
}

async function fetchHistory(wpUserId: number, limit = 20): Promise<RewardTransaction[]> {
  try {
    const res = await fetch(
      `${API_BASE}/history?user_id=${wpUserId}&api_key=${API_KEY}&limit=${limit}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.history || []).map((item: any) => ({
      id: item.id.toString(),
      type: item.points >= 0 ? "earn" : "redeem",
      amount: Math.abs(item.points),
      reference: item.type,
      description: item.description,
      date: item.date,
    }));
  } catch (e) {
    console.warn("Failed to fetch rewards history:", e);
    return [];
  }
}

async function fetchUserByEmail(email: string): Promise<{ user_id: number; balance: number; total_earned: number } | null> {
  try {
    const res = await fetch(
      `${API_BASE}/user-by-email?email=${encodeURIComponent(email)}&api_key=${API_KEY}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("Failed to fetch user by email:", e);
    return null;
  }
}

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<RewardsState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Auto-sync when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.email && !isLoading) {
      syncRewards();
    }
  }, [isAuthenticated, user?.email, isLoading]);

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
    if (!user?.email || isSyncing) return;
    setIsSyncing(true);

    try {
      // First, find the WP user ID by email
      let wpUserId = state.wpUserId;
      if (!wpUserId) {
        const wpUser = await fetchUserByEmail(user.email);
        if (wpUser) {
          wpUserId = wpUser.user_id;
        }
      }

      if (!wpUserId) {
        // User not found on WP - keep local state
        setIsSyncing(false);
        return;
      }

      // Fetch balance from server
      const balanceData = await fetchBalance(wpUserId);
      if (!balanceData) {
        setIsSyncing(false);
        return;
      }

      // Fetch history
      const history = await fetchHistory(wpUserId);

      // Update state with server data
      const tier = getTierForPoints(balanceData.total_earned);
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
        referralCode: state.referralCode || generateReferralCode(user?.id?.toString()),
      };

      setState(newState);
      await saveState(newState);
    } catch (e) {
      console.warn("Failed to sync rewards:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.email, state.wpUserId, isSyncing, saveState]);

  // Check if user can redeem (must have 750+ lifetime pts = 750 000 Ar spent)
  const canRedeem = state.lifetimePoints >= REDEMPTION_MIN_POINTS_LIFETIME;
  const pointsUntilRedemption = canRedeem ? 0 : REDEMPTION_MIN_POINTS_LIFETIME - state.lifetimePoints;

  // Get the best redemption tier for a given number of points
  const getBestRedemption = useCallback((points: number): { points: number; value: number } | null => {
    // Block redemption if user hasn't reached 750 lifetime pts (750 000 Ar spent)
    if (state.lifetimePoints < REDEMPTION_MIN_POINTS_LIFETIME) return null;
    // Find the highest redemption tier the user can afford
    const affordable = REDEMPTION_TIERS.filter(t => t.points <= points);
    if (affordable.length === 0) return null;
    return affordable[affordable.length - 1];
  }, [state.lifetimePoints]);

  // Legacy discount calculation (backward compat)
  const getDiscountValue = useCallback((points: number): number => {
    const best = getBestRedemption(points);
    return best ? best.value : 0;
  }, [getBestRedemption]);

  // Computed values
  const currentTier = TIERS.find(t => t.id === state.tier) || TIERS[0];
  const currentTierIndex = TIERS.findIndex(t => t.id === state.tier);
  const nextTierInfo = currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;
  
  const progressToNextTier = nextTierInfo
    ? Math.min(1, (state.lifetimePoints - currentTier.minPoints) / (nextTierInfo.minPoints - currentTier.minPoints))
    : 1;
  
  const pointsToNextTier = nextTierInfo
    ? Math.max(0, nextTierInfo.minPoints - state.lifetimePoints)
    : 0;

  return (
    <RewardsContext.Provider
      value={{
        state,
        currentTier,
        nextTier: nextTierInfo,
        progressToNextTier,
        pointsToNextTier,
        canRedeem,
        pointsUntilRedemption,
        syncRewards,
        getDiscountValue,
        getBestRedemption,
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
export function estimatePointsForPrice(priceAr: number, multiplier: number = 1): number {
  const base = Math.floor(priceAr / EARN_RULES.purchaseUnit);
  return Math.floor(base * multiplier);
}

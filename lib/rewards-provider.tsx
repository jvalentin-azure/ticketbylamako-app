import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";
import Constants from "expo-constants";

// ===== API CONFIGURATION =====
const API_BASE = "https://www.ticketbylamako.com/wp-json/lamako-rewards/v1";
// API key from environment variable (set via EXPO_PUBLIC_REWARDS_API_KEY)
const API_KEY = process.env.EXPO_PUBLIC_REWARDS_API_KEY || (Constants.expoConfig?.extra as any)?.rewardsApiKey || "LR_2024_SECURE_KEY_TBL";

// ===== TIERS (based on industry benchmarks: Sephora, Starbucks, Fnac) =====
// Tiers are based on LIFETIME SPENDING (converted to points at 1pt/1000Ar)
// Average ticket: 50,000 Ar = 50 pts per event
// Fan: 0 (free join)
// VIP: 150 pts (~150,000 Ar = 2-3 events) - achievable quickly to hook users
// Super VIP: 750 pts (~750,000 Ar = 5-8 events) - regular attendees
// Elite: 3000 pts (~3,000,000 Ar = 20+ events) - superfans/annual heavy spenders

export type RewardTier = "fan" | "vip" | "supervip" | "elite";

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
    id: "vip",
    name: "VIP",
    minPoints: 150,
    color: "#C0C0C0",
    icon: "⭐",
    discountPercent: 5,
    multiplier: 1.5,
    benefits: [
      "5% de réduction sur les billets",
      "x1.5 points sur chaque achat",
      "Accès prioritaire aux préventes",
      "Offres exclusives par notification",
      "Support prioritaire WhatsApp",
    ],
  },
  {
    id: "supervip",
    name: "Super VIP",
    minPoints: 750,
    color: "#FFD700",
    icon: "🌟",
    discountPercent: 10,
    multiplier: 2,
    benefits: [
      "10% de réduction sur les billets",
      "x2 points sur chaque achat",
      "Accès VIP aux événements",
      "Places gratuites (loterie mensuelle)",
      "Cadeaux surprises aux événements",
      "Invitation aux avant-premières",
      "Support dédié",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    minPoints: 3000,
    color: "#E5E4E2",
    icon: "💎",
    discountPercent: 15,
    multiplier: 3,
    benefits: [
      "15% de réduction sur tous les achats",
      "x3 points sur chaque achat",
      "Accès backstage",
      "1 billet gratuit par trimestre",
      "Invitations privées (meet & greet)",
      "Conciergerie événementielle dédiée",
      "Surclassement automatique de place",
      "Livraison gratuite boutique",
    ],
  },
];

// ===== EARN RULES =====
export const EARN_RULES = {
  purchaseRate: 1, // 1 point per 1000 Ar spent
  purchaseUnit: 1000, // Ar per point
  registrationBonus: 50,
  loginBonus: 5, // per day (max 1x/day)
  eventAttendanceBonus: 10, // scan at entry
  reviewBonus: 15, // leave a review
  referralBonus: 100, // when referee makes first purchase
  refereeBonus: 25, // bonus for the new user who used a referral code
  birthdayBonus: 50, // annual birthday bonus
  shareBonus: 5, // share event on social media
};

// ===== REDEMPTION RULES =====
// Progressive rate: more points = better value (incentivizes saving)
export const REDEMPTION_TIERS = [
  { points: 50, value: 5000, label: "50 pts = 5 000 Ar" },
  { points: 100, value: 12000, label: "100 pts = 12 000 Ar" },
  { points: 200, value: 30000, label: "200 pts = 30 000 Ar" },
  { points: 500, value: 80000, label: "500 pts = 80 000 Ar" },
  { points: 1000, value: 180000, label: "1000 pts = 180 000 Ar" },
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
  nextTier: "VIP",
  pointsToNextTier: 150,
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
  syncRewards: () => Promise<void>;
  getDiscountValue: (points: number) => number;
  getBestRedemption: (points: number) => { points: number; value: number } | null;
  isLoading: boolean;
  isSyncing: boolean;
}

const RewardsContext = createContext<RewardsContextType | null>(null);

const STORAGE_KEY = "@lamako_rewards";

function getTierForPoints(lifetimePoints: number): RewardTier {
  if (lifetimePoints >= 3000) return "elite";
  if (lifetimePoints >= 750) return "supervip";
  if (lifetimePoints >= 150) return "vip";
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

  // Get the best redemption tier for a given number of points
  const getBestRedemption = useCallback((points: number): { points: number; value: number } | null => {
    // Find the highest redemption tier the user can afford
    const affordable = REDEMPTION_TIERS.filter(t => t.points <= points);
    if (affordable.length === 0) return null;
    return affordable[affordable.length - 1];
  }, []);

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

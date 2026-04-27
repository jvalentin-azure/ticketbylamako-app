import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-provider";

// ===== API CONFIGURATION =====
const API_BASE = "https://www.ticketbylamako.com/wp-json/lamako-rewards/v1";
const API_KEY = "LR_2024_SECURE_KEY_TBL";

// ===== TIERS =====
export type RewardTier = "bronze" | "argent" | "or" | "platine";

export interface TierInfo {
  id: RewardTier;
  name: string;
  minPoints: number;
  color: string;
  icon: string;
  benefits: string[];
}

export const TIERS: TierInfo[] = [
  {
    id: "bronze",
    name: "Bronze",
    minPoints: 0,
    color: "#CD7F32",
    icon: "🥉",
    benefits: ["Accès aux événements", "Historique des points"],
  },
  {
    id: "argent",
    name: "Argent",
    minPoints: 500,
    color: "#C0C0C0",
    icon: "🥈",
    benefits: ["5% de réduction", "Accès prioritaire", "Offres exclusives"],
  },
  {
    id: "or",
    name: "Or",
    minPoints: 2000,
    color: "#FFD700",
    icon: "🥇",
    benefits: ["10% de réduction", "Accès VIP", "Cadeaux surprises", "Support prioritaire"],
  },
  {
    id: "platine",
    name: "Platine",
    minPoints: 5000,
    color: "#E5E4E2",
    icon: "💎",
    benefits: ["15% de réduction", "Accès backstage", "Invitations privées", "Conciergerie dédiée"],
  },
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
  tier: "bronze",
  nextTier: "Argent",
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
  syncRewards: () => Promise<void>;
  getDiscountValue: (points: number) => number;
  isLoading: boolean;
  isSyncing: boolean;
}

const RewardsContext = createContext<RewardsContextType | null>(null);

const STORAGE_KEY = "@lamako_rewards";

function getTierForPoints(lifetimePoints: number): RewardTier {
  if (lifetimePoints >= 5000) return "platine";
  if (lifetimePoints >= 2000) return "or";
  if (lifetimePoints >= 500) return "argent";
  return "bronze";
}

function generateReferralCode(userId?: string): string {
  const base = userId ? userId.slice(0, 4) : "LMK";
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${random}`;
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

  const getDiscountValue = useCallback((points: number): number => {
    return Math.floor(points / 100) * 5000; // 100 pts = 5000 Ar
  }, []);

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

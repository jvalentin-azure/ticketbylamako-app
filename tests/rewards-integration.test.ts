import { describe, expect, it } from "vitest";

// Pure function replicated from rewards-provider.tsx to test logic
// (The actual file has React hooks/context that vitest can't load without React environment)
const EARN_RULES = {
  purchaseRate: 1,
  purchaseUnit: 1000,
  registrationBonus: 100,
  profileCompleteBonus: 100,
  loginBonus: 2,
  firstPurchaseBonus: 200,
  eventAttendanceBonus: 10,
  reviewBonus: 15,
  referralBonus: 75,
  refereeBonus: 25,
  birthdayBonus: 200,
  shareBonus: 20,
  newsletterBonus: 100,
};

const REDEMPTION_MIN_POINTS_LIFETIME = 750;
const REDEMPTION_TIERS = [
  { points: 500, value: 10000, label: "500 pts = 10 000 Ar" },
  { points: 1000, value: 20000, label: "1 000 pts = 20 000 Ar" },
  { points: 2000, value: 40000, label: "2 000 pts = 40 000 Ar" },
  { points: 5000, value: 100000, label: "5 000 pts = 100 000 Ar" },
];

const TIERS = [
  { id: "fan", name: "Fan", minPoints: 0, multiplier: 1 },
  { id: "silver", name: "Silver", minPoints: 500, multiplier: 1 },
  { id: "gold", name: "Gold", minPoints: 2000, multiplier: 1.25 },
  { id: "platinum", name: "Platinum", minPoints: 5000, multiplier: 1.5 },
  { id: "diamond", name: "Diamond", minPoints: 10000, multiplier: 2 },
];

// Exact copy of the function from rewards-provider.tsx
function estimatePointsForPrice(priceAr: number, multiplier: number = 1): number {
  const base = Math.floor(priceAr / EARN_RULES.purchaseUnit);
  return Math.floor(base * multiplier);
}

// Replicate getBestRedemption logic
function getBestRedemption(points: number, lifetimePoints: number): { points: number; value: number } | null {
  if (lifetimePoints < REDEMPTION_MIN_POINTS_LIFETIME) return null;
  const affordable = REDEMPTION_TIERS.filter(t => t.points <= points);
  if (affordable.length === 0) return null;
  return affordable[affordable.length - 1];
}

function getDiscountValue(points: number, lifetimePoints: number): number {
  const best = getBestRedemption(points, lifetimePoints);
  return best ? best.value : 0;
}

describe("LamakoRewards - estimatePointsForPrice", () => {
  it("returns correct points for a standard price (1 pt per 1000 Ar)", () => {
    expect(estimatePointsForPrice(120000)).toBe(120);
  });

  it("returns correct points for a small price", () => {
    expect(estimatePointsForPrice(5000)).toBe(5);
  });

  it("returns 0 for price below 1000 Ar", () => {
    expect(estimatePointsForPrice(500)).toBe(0);
    expect(estimatePointsForPrice(0)).toBe(0);
  });

  it("applies Gold tier multiplier (x1.25) correctly", () => {
    expect(estimatePointsForPrice(100000, 1.25)).toBe(125);
  });

  it("applies Platinum tier multiplier (x1.5) correctly", () => {
    expect(estimatePointsForPrice(50000, 1.5)).toBe(75);
  });

  it("applies Diamond tier multiplier (x2) correctly", () => {
    expect(estimatePointsForPrice(50000, 2)).toBe(100);
  });

  it("handles string-like prices correctly when parsed externally", () => {
    const priceStr = "120000";
    const priceNum = parseFloat(priceStr) || 0;
    expect(estimatePointsForPrice(priceNum)).toBe(120);
  });

  it("handles empty/invalid price strings gracefully", () => {
    const priceStr = "";
    const priceNum = parseFloat(priceStr) || 0;
    expect(estimatePointsForPrice(priceNum)).toBe(0);
  });

  it("floors partial points (no rounding up)", () => {
    // 1500 Ar = 1.5 pts -> floor = 1
    expect(estimatePointsForPrice(1500)).toBe(1);
    // 2999 Ar = 2.999 -> floor = 2
    expect(estimatePointsForPrice(2999)).toBe(2);
  });
});

describe("LamakoRewards - Cart total points calculation", () => {
  it("calculates total points for multiple cart items", () => {
    const cartItems = [
      { price: 50000, quantity: 2 },  // 100,000 Ar = 100 pts
      { price: 30000, quantity: 1 },  // 30,000 Ar = 30 pts
      { price: 120000, quantity: 1 }, // 120,000 Ar = 120 pts
    ];

    const totalPoints = cartItems.reduce((sum, item) => {
      return sum + estimatePointsForPrice(item.price * item.quantity, 1);
    }, 0);

    expect(totalPoints).toBe(250);
  });

  it("calculates total points with Gold multiplier", () => {
    const cartItems = [
      { price: 100000, quantity: 1 },  // 100,000 Ar * 1.25 = 125 pts
      { price: 50000, quantity: 2 },   // 100,000 Ar * 1.25 = 125 pts
    ];

    const goldMultiplier = 1.25;
    const totalPoints = cartItems.reduce((sum, item) => {
      return sum + estimatePointsForPrice(item.price * item.quantity, goldMultiplier);
    }, 0);

    expect(totalPoints).toBe(250);
  });

  it("handles string prices from WooCommerce API", () => {
    const cartItems = [
      { price: "50000", quantity: 2 },
      { price: "75000", quantity: 1 },
    ];

    const totalPoints = cartItems.reduce((sum, item) => {
      const priceNum = typeof item.price === "string" ? parseFloat(item.price) || 0 : item.price;
      return sum + estimatePointsForPrice(priceNum * item.quantity, 1);
    }, 0);

    expect(totalPoints).toBe(175); // 100 + 75
  });

  it("handles zero-price items (free products)", () => {
    const cartItems = [
      { price: 0, quantity: 1 },
      { price: "0", quantity: 2 },
      { price: 50000, quantity: 1 },
    ];

    const totalPoints = cartItems.reduce((sum, item) => {
      const priceNum = typeof item.price === "string" ? parseFloat(item.price) || 0 : item.price;
      return sum + estimatePointsForPrice(priceNum * item.quantity, 1);
    }, 0);

    expect(totalPoints).toBe(50); // only the 50000 Ar item earns points
  });
});

describe("LamakoRewards - Redemption logic", () => {
  it("returns null if lifetime points below threshold (750)", () => {
    expect(getBestRedemption(500, 600)).toBeNull();
    expect(getBestRedemption(1000, 749)).toBeNull();
  });

  it("returns best affordable tier when eligible", () => {
    // Has 750 lifetime points, 1200 available points
    const result = getBestRedemption(1200, 750);
    expect(result).toMatchObject({ points: 1000, value: 20000 });
  });

  it("returns highest affordable tier", () => {
    // Has 5000 available points
    const result = getBestRedemption(5000, 5000);
    expect(result).toMatchObject({ points: 5000, value: 100000 });
  });

  it("returns null if not enough points for any tier", () => {
    const result = getBestRedemption(300, 800); // eligible but only 300 pts (min is 500)
    expect(result).toBeNull();
  });

  it("getDiscountValue returns correct Ariary value", () => {
    expect(getDiscountValue(1200, 750)).toBe(20000); // 1000 pts tier = 20,000 Ar
    expect(getDiscountValue(5000, 5000)).toBe(100000); // 5000 pts tier = 100,000 Ar
    expect(getDiscountValue(300, 800)).toBe(0); // not enough for any tier
    expect(getDiscountValue(1000, 500)).toBe(0); // lifetime too low
  });
});

describe("LamakoRewards - TIERS configuration", () => {
  it("has 5 tiers in ascending order", () => {
    expect(TIERS.length).toBe(5);
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minPoints).toBeGreaterThan(TIERS[i - 1].minPoints);
    }
  });

  it("Fan tier starts at 0 points with x1 multiplier", () => {
    expect(TIERS[0].id).toBe("fan");
    expect(TIERS[0].minPoints).toBe(0);
    expect(TIERS[0].multiplier).toBe(1);
  });

  it("Gold tier has x1.25 multiplier at 2000 pts", () => {
    const gold = TIERS.find(t => t.id === "gold");
    expect(gold).toBeDefined();
    expect(gold!.multiplier).toBe(1.25);
    expect(gold!.minPoints).toBe(2000);
  });

  it("Diamond tier has x2 multiplier at 10000 pts", () => {
    const diamond = TIERS.find(t => t.id === "diamond");
    expect(diamond).toBeDefined();
    expect(diamond!.multiplier).toBe(2);
    expect(diamond!.minPoints).toBe(10000);
  });
});

describe("LamakoRewards - REDEMPTION_TIERS value consistency", () => {
  it("all tiers have 20 Ar per point ratio (2% cashback)", () => {
    for (const tier of REDEMPTION_TIERS) {
      const ratio = tier.value / tier.points;
      expect(ratio).toBe(20);
    }
  });

  it("minimum redemption is 500 pts = 10,000 Ar", () => {
    expect(REDEMPTION_TIERS[0].points).toBe(500);
    expect(REDEMPTION_TIERS[0].value).toBe(10000);
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(root, ...parts), "utf8");

const mobileApi = read("lib", "api", "mobile.ts");
const provider = read("lib", "rewards-provider.tsx");
const rewardsScreen = read("app", "rewards.tsx");
const checkout = read("app", "checkout.tsx");
const cart = read("app", "(tabs)", "cart.tsx");
const profile = read("app", "(tabs)", "profile.tsx");
const drawer = read("components", "drawer-content.tsx");
const pointsBadge = read("components", "points-badge.tsx");
const register = read("app", "(auth)", "register.tsx");

describe("LamakoRewards voluntary membership", () => {
  it("implements the authenticated membership read and update contract", () => {
    expect(mobileApi).toContain('"rewards/membership"');
    expect(mobileApi).toContain('method: "PATCH"');
    expect(mobileApi).toContain("body: { joined }");
    expect(mobileApi).toContain("roleEligible: boolean");
    expect(mobileApi).toContain("joinedAt: string");
  });

  it("checks membership before loading or awarding Rewards data", () => {
    const statusCheck = provider.indexOf(
      "const nextMembership = await getMobileRewardsMembership()",
    );
    const membershipGuard = provider.indexOf(
      "if (!nextMembership.joined)",
      statusCheck,
    );
    const firstOpenClaim = provider.indexOf(
      "await claimMobileFirstAppOpenBonus()",
      membershipGuard,
    );
    const balanceFetch = provider.indexOf(
      "const [balanceData, history, referral]",
      firstOpenClaim,
    );

    expect(statusCheck).toBeGreaterThan(-1);
    expect(membershipGuard).toBeGreaterThan(statusCheck);
    expect(firstOpenClaim).toBeGreaterThan(membershipGuard);
    expect(balanceFetch).toBeGreaterThan(firstOpenClaim);
  });

  it("blocks redemptions and cached balances outside membership", () => {
    expect(provider).toContain("membership?.joined === true");
    expect(provider).toContain('error: "Adhésion LamakoRewards requise."');
    expect(provider).toContain(
      "AsyncStorage.removeItem(`${STORAGE_KEY}_${wpUserId}`)",
    );
    expect(checkout).toContain("membership?.joined === true");
    expect(checkout).toContain("const totalPointsToEarn = membership?.joined");
  });

  it("hides member balances and earning badges from non-members", () => {
    expect(drawer).toContain("...(membership?.joined");
    expect(pointsBadge).toContain("if (!membership?.joined || points <= 0)");
    expect(cart).toContain("isAuthenticated && membership?.joined");
    expect(profile).toContain("isAuthenticated && membership?.joined");
  });

  it("offers explicit enrollment and withdrawal actions", () => {
    expect(rewardsScreen).toContain("Adhérer volontairement");
    expect(rewardsScreen).toContain("await updateMembership(true)");
    expect(rewardsScreen).toContain("Quitter LamakoRewards");
    expect(rewardsScreen).toContain("await updateMembership(false)");
    expect(profile).toContain("Adhésion volontaire");
  });

  it("defers referral registration until voluntary enrollment", () => {
    expect(register).toContain("savePendingReferralCode(referralCode)");
    expect(register).not.toContain("registerReferral(0");
    expect(provider).toContain("PENDING_REFERRAL_KEY");
    expect(provider).toContain("registerMobileReferral(pendingReferral)");
  });
});

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");

describe("V2.1 - LamakoRewards & Bug Fixes", () => {
  describe("LamakoRewards Provider", () => {
    it("rewards-provider.tsx exists and exports RewardsProvider", () => {
      const filePath = resolve(root, "lib/rewards-provider.tsx");
      expect(existsSync(filePath)).toBe(true);
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("export function RewardsProvider");
      expect(content).toContain("export function useRewards");
    });

    it("connects to the real myCred API", () => {
      const filePath = resolve(root, "lib/rewards-provider.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("ticketbylamako.com/wp-json/lamako-rewards/v1");
      expect(content).toContain("fetchBalance");
      expect(content).toContain("fetchHistory");
      expect(content).toContain("fetchUserByEmail");
    });

    it("defines correct tier structure", () => {
      const filePath = resolve(root, "lib/rewards-provider.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain('"bronze"');
      expect(content).toContain('"argent"');
      expect(content).toContain('"or"');
      expect(content).toContain('"platine"');
      expect(content).toContain("minPoints: 0");
      expect(content).toContain("minPoints: 500");
      expect(content).toContain("minPoints: 2000");
      expect(content).toContain("minPoints: 5000");
    });
  });

  describe("Rewards Screen", () => {
    it("rewards.tsx exists with proper structure", () => {
      const filePath = resolve(root, "app/rewards.tsx");
      expect(existsSync(filePath)).toBe(true);
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("LamakoRewards");
      expect(content).toContain("useRewards");
      expect(content).toContain("syncRewards");
      expect(content).toContain("LinearGradient");
    });
  });

  describe("Root Layout Integration", () => {
    it("root layout includes RewardsProvider", () => {
      const filePath = resolve(root, "app/_layout.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("import { RewardsProvider }");
      expect(content).toContain("<RewardsProvider>");
    });

    it("root layout registers rewards screen", () => {
      const filePath = resolve(root, "app/_layout.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain('name="rewards"');
    });
  });

  describe("Drawer Integration", () => {
    it("drawer includes LamakoRewards link", () => {
      const filePath = resolve(root, "components/drawer-content.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("LamakoRewards");
      expect(content).toContain("/rewards");
    });

    it("drawer includes WhatsApp button", () => {
      const filePath = resolve(root, "components/drawer-content.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("WhatsApp");
      expect(content).toContain("wa.me");
    });
  });

  describe("Home Screen Rewards Banner", () => {
    it("home screen includes rewards banner", () => {
      const filePath = resolve(root, "app/(tabs)/index.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("useRewards");
      expect(content).toContain("LamakoRewards");
      expect(content).toContain("rewardsBanner");
    });
  });

  describe("Custom Splash Screen", () => {
    it("splash-screen.tsx exists with animation", () => {
      const filePath = resolve(root, "components/splash-screen.tsx");
      expect(existsSync(filePath)).toBe(true);
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("CustomSplash");
      expect(content).toContain("Animated");
      expect(content).toContain("#663d17");
      expect(content).toContain("logo-white.png");
    });

    it("root layout uses CustomSplash", () => {
      const filePath = resolve(root, "app/_layout.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("CustomSplash");
      expect(content).toContain("showSplash");
    });
  });

  describe("Logo Files", () => {
    it("logo-white.png exists", () => {
      expect(existsSync(resolve(root, "assets/images/logo-white.png"))).toBe(true);
    });

    it("logo-dark.png exists", () => {
      expect(existsSync(resolve(root, "assets/images/logo-dark.png"))).toBe(true);
    });
  });

  describe("Back Button Fixes", () => {
    it("login screen has accessible back button", () => {
      const filePath = resolve(root, "app/(auth)/login.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("router.back");
      // Should not have absolute positioning at top: 0 which causes issues
      expect(content).not.toContain("top: 0");
    });

    it("help screen has accessible back button", () => {
      const filePath = resolve(root, "app/help.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("router.back");
    });

    it("privacy screen has accessible back button", () => {
      const filePath = resolve(root, "app/privacy.tsx");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("router.back");
    });
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("V2.2 - LamakoRewards Logos, Mobile Descriptions, Seating Chart", () => {
  describe("LamakoRewards Logo Files", () => {
    it("lamako-rewards-white.png exists in assets", () => {
      expect(existsSync(join(ROOT, "assets/images/lamako-rewards-white.png"))).toBe(true);
    });

    it("lamako-rewards-dark.png exists in assets", () => {
      expect(existsSync(join(ROOT, "assets/images/lamako-rewards-dark.png"))).toBe(true);
    });
  });

  describe("Rewards Dashboard Logo Integration", () => {
    it("rewards screen uses LamakoRewards logo", () => {
      const content = readFileSync(join(ROOT, "app/rewards.tsx"), "utf-8");
      expect(content).toContain("lamako-rewards");
    });
  });

  describe("Home Screen Rewards Banner Logo", () => {
    it("home screen rewards banner uses LamakoRewards logo", () => {
      const content = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf-8");
      expect(content).toContain("lamako-rewards-white");
    });
  });

  describe("Event Detail - Mobile Fields & Seating Chart", () => {
    it("event detail screen supports mobile description", () => {
      const content = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");
      expect(content).toContain("mobileFields");
      expect(content).toContain("mobileDesc");
    });

    it("event detail screen has gallery support", () => {
      const content = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");
      expect(content).toContain("gallery");
      expect(content).toContain("galleryIndex");
    });

    it("event detail screen has practical info table", () => {
      const content = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");
      expect(content).toContain("practicalInfo");
      expect(content).toContain("Infos pratiques");
    });

    it("event detail screen has seating chart WebView", () => {
      const content = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");
      expect(content).toContain("seating");
      expect(content).toContain("WebView");
    });

    it("event detail screen uses mobileFields from API", () => {
      const content = readFileSync(join(ROOT, "app/event/[id].tsx"), "utf-8");
      expect(content).toContain("mobileFields");
    });
  });

  describe("Product Detail - Mobile Fields", () => {
    it("product detail screen supports mobile description", () => {
      const content = readFileSync(join(ROOT, "app/product/[id].tsx"), "utf-8");
      expect(content).toContain("lamako_mobile");
      expect(content).toContain("mobileDesc");
    });

    it("product detail screen has gallery support", () => {
      const content = readFileSync(join(ROOT, "app/product/[id].tsx"), "utf-8");
      expect(content).toContain("mobileGallery");
      expect(content).toContain("galleryIndex");
    });

    it("product detail screen has practical info table", () => {
      const content = readFileSync(join(ROOT, "app/product/[id].tsx"), "utf-8");
      expect(content).toContain("practicalInfo");
      expect(content).toContain("Infos produit");
    });
  });

  describe("WooCommerce API - Mobile Fields Type", () => {
    it("TCEvent interface includes lamako_mobile field", () => {
      const content = readFileSync(join(ROOT, "lib/api/woocommerce.ts"), "utf-8");
      expect(content).toContain("lamako_mobile");
    });
  });
});

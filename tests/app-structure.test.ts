import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const APP_DIR = path.resolve(__dirname, "../app");
const TABS_DIR = path.join(APP_DIR, "(tabs)");
const AUTH_DIR = path.join(APP_DIR, "(auth)");

describe("App Structure", () => {
  it("has all required client tab screens", () => {
    const requiredTabs = [
      "index.tsx",
      "events.tsx",
      "shop.tsx",
      "cart.tsx",
      "tickets.tsx",
      "profile.tsx",
      "_layout.tsx",
    ];
    for (const tab of requiredTabs) {
      expect(fs.existsSync(path.join(TABS_DIR, tab)), `Missing tab: ${tab}`).toBe(true);
    }
  });

  it("does not contain admin/organiser screens (moved to backend app)", () => {
    const removedScreens = [
      "org-dashboard.tsx",
      "scanner.tsx",
      "participants.tsx",
      "reports.tsx",
      "admin-dashboard.tsx",
      "admin-orders.tsx",
      "admin-analytics.tsx",
    ];
    for (const screen of removedScreens) {
      expect(fs.existsSync(path.join(TABS_DIR, screen)), `Admin screen should be removed: ${screen}`).toBe(false);
    }
  });

  it("has auth screens", () => {
    expect(fs.existsSync(path.join(AUTH_DIR, "login.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(AUTH_DIR, "register.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(AUTH_DIR, "_layout.tsx"))).toBe(true);
  });

  it("has detail screens", () => {
    expect(fs.existsSync(path.join(APP_DIR, "event/[id].tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "product/[id].tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "ticket/[id].tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "checkout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP_DIR, "orders.tsx"))).toBe(true);
  });

  it("has API service files (no tickera - moved to backend)", () => {
    const libDir = path.resolve(__dirname, "../lib/api");
    expect(fs.existsSync(path.join(libDir, "woocommerce.ts"))).toBe(true);
    expect(fs.existsSync(path.join(libDir, "auth.ts"))).toBe(true);
    expect(fs.existsSync(path.join(libDir, "tickera.ts"))).toBe(false); // Moved to backend app
  });

  it("has providers", () => {
    const libDir = path.resolve(__dirname, "../lib");
    expect(fs.existsSync(path.join(libDir, "auth-provider.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(libDir, "cart-provider.tsx"))).toBe(true);
  });

  it("auth provider does not contain portal system", () => {
    const authProvider = fs.readFileSync(path.resolve(__dirname, "../lib/auth-provider.tsx"), "utf-8");
    expect(authProvider).not.toContain("switchPortal");
    expect(authProvider).not.toContain("PortalType");
  });

  it("has correct app icon", () => {
    const iconPath = path.resolve(__dirname, "../assets/images/icon.png");
    expect(fs.existsSync(iconPath)).toBe(true);
    const stat = fs.statSync(iconPath);
    expect(stat.size).toBeGreaterThan(100000);
  });

  it("tab layout registers all tab files", () => {
    const layoutContent = fs.readFileSync(path.join(TABS_DIR, "_layout.tsx"), "utf-8");
    const tabFiles = fs.readdirSync(TABS_DIR).filter(f => f !== "_layout.tsx" && f.endsWith(".tsx"));
    for (const file of tabFiles) {
      const name = file.replace(".tsx", "");
      expect(layoutContent, `Tab file ${file} not registered in _layout.tsx`).toContain(`name="${name}"`);
    }
  });
});

describe("Theme Configuration", () => {
  it("has TicketByLamako brand colors", () => {
    const themeConfig = fs.readFileSync(path.resolve(__dirname, "../theme.config.js"), "utf-8");
    expect(themeConfig).toContain("#663d17");
    expect(themeConfig).toContain("#c79f6c");
  });
});

describe("App Config", () => {
  it("has correct app name", () => {
    const configContent = fs.readFileSync(path.resolve(__dirname, "../app.config.ts"), "utf-8");
    expect(configContent).toContain('appName: "TicketByLamako"');
    expect(configContent).toContain("logoUrl:");
    expect(configContent).not.toContain('logoUrl: ""');
  });
});

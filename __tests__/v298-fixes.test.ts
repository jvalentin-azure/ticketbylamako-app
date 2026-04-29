import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("V2.9.8 - Onboarding Fix", () => {
  it("should validate token server-side before skipping onboarding", () => {
    const layout = fs.readFileSync(path.join(ROOT, "app/_layout.tsx"), "utf-8");
    // Must use validateToken() not just getStoredUser()
    expect(layout).toContain("validateToken()");
    expect(layout).toContain("getStoredToken");
    // Must show splash when token is invalid
    expect(layout).toContain("Token expired/invalid - show onboarding");
  });

  it("splash-screen should not use AsyncStorage to decide visibility", () => {
    const splash = fs.readFileSync(path.join(ROOT, "components/splash-screen.tsx"), "utf-8");
    // Should NOT check AsyncStorage for hasSeenSplash
    expect(splash).not.toContain("hasSeenSplash");
    expect(splash).not.toContain("@lamako_splash_seen");
    // Should have the three buttons
    expect(splash).toContain("S'inscrire");
    expect(splash).toContain("Se connecter");
    expect(splash).toContain("Explorer");
  });
});

describe("V2.9.8 - LamakoRewards Popup Fix", () => {
  it("should use in-memory flag, not AsyncStorage for session tracking", () => {
    const popup = fs.readFileSync(path.join(ROOT, "components/rewards-popup.tsx"), "utf-8");
    expect(popup).toContain("rewardsPopupShownThisSession");
    // Should NOT use AsyncStorage for the shown check
    expect(popup).not.toContain("REWARDS_POPUP_KEY");
    expect(popup).not.toContain("@lamako_rewards_popup_shown_session");
  });

  it("should use rewards-bg.jpg not concert-bg.jpg", () => {
    const popup = fs.readFileSync(path.join(ROOT, "components/rewards-popup.tsx"), "utf-8");
    expect(popup).toContain("rewards-bg.jpg");
    expect(popup).not.toContain("concert-bg.jpg");
  });
});

describe("V2.9.8 - Filter Redirect Fix", () => {
  it("should use global filter state module", () => {
    const filterState = fs.readFileSync(path.join(ROOT, "lib/filter-state.ts"), "utf-8");
    expect(filterState).toContain("setPendingCategory");
    expect(filterState).toContain("consumePendingCategory");
    expect(filterState).toContain("subscribeToPendingCategory");
  });

  it("home page should use setPendingCategory before navigating", () => {
    const home = fs.readFileSync(path.join(ROOT, "app/(tabs)/index.tsx"), "utf-8");
    expect(home).toContain("setPendingCategory");
    expect(home).toContain("import { setPendingCategory } from");
  });

  it("events page should consume pending category", () => {
    const events = fs.readFileSync(path.join(ROOT, "app/(tabs)/events.tsx"), "utf-8");
    expect(events).toContain("consumePendingCategory");
    expect(events).toContain("subscribeToPendingCategory");
    expect(events).toContain("applyCategory");
  });
});

describe("V2.9.8 - Boutique Spacing Fix", () => {
  it("should have reduced spacing values", () => {
    const shop = fs.readFileSync(path.join(ROOT, "app/(tabs)/shop.tsx"), "utf-8");
    // headerRow should have minimal padding
    expect(shop).toContain("paddingBottom: 2");
    // chipsContainer should have paddingTop: 0
    expect(shop).toContain("paddingTop: 0");
  });
});

describe("V2.9.8 - Seating Chart Seat Clearing Fix", () => {
  it("should call clearServerCart when closing seating chart", () => {
    const eventPage = fs.readFileSync(path.join(ROOT, "app/event/[id].tsx"), "utf-8");
    expect(eventPage).toContain("clearServerCart()");
    expect(eventPage).toContain("import { getTCEvent, getEventTickets, getSeatingChartUrl, getEventsWithTickets, clearServerCart");
  });

  it("WordPress plugin should clear ALL seat transients via SQL", () => {
    const plugin = fs.readFileSync(path.join(ROOT, "scripts/lamako-mobile-api/lamako-mobile-api.php"), "utf-8");
    expect(plugin).toContain("_transient_tc_seat_%");
    expect(plugin).toContain("_transient_tc_cart_seat_%");
    expect(plugin).toContain("DELETE FROM");
  });

  it("root plugin should also clear ALL seat transients via SQL", () => {
    const plugin = fs.readFileSync(path.join(ROOT, "scripts/lamako-mobile-api.php"), "utf-8");
    expect(plugin).toContain("_transient_tc_seat_%");
    expect(plugin).toContain("_transient_tc_cart_seat_%");
    expect(plugin).toContain("DELETE FROM");
  });
});

describe("V2.9.8 - Burger Menu Fix", () => {
  it("should not have a Navigation section in drawer", () => {
    const drawer = fs.readFileSync(path.join(ROOT, "components/drawer-content.tsx"), "utf-8");
    // Should not have navigation items that duplicate tab bar
    expect(drawer).not.toContain("\"Navigation\"");
  });
});

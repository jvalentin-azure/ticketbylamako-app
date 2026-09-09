import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRewardsEnabled } from "@/lib/rewards-eligibility";

const root = path.resolve(__dirname, "..");
const drawer = fs.readFileSync(
  path.join(root, "components", "drawer-content.tsx"),
  "utf8",
);
const profile = fs.readFileSync(
  path.join(root, "app", "(tabs)", "profile.tsx"),
  "utf8",
);
const editProfile = fs.readFileSync(
  path.join(root, "app", "edit-profile.tsx"),
  "utf8",
);
const themeProvider = fs.readFileSync(
  path.join(root, "lib", "theme-provider.tsx"),
  "utf8",
);
const tabs = fs.readFileSync(
  path.join(root, "app", "(tabs)", "_layout.tsx"),
  "utf8",
);
const rewards = fs.readFileSync(path.join(root, "app", "rewards.tsx"), "utf8");
const rewardsProvider = fs.readFileSync(
  path.join(root, "lib", "rewards-provider.tsx"),
  "utf8",
);
const mobileApi = fs.readFileSync(
  path.join(root, "lib", "api", "mobile.ts"),
  "utf8",
);
const checkout = fs.readFileSync(
  path.join(root, "app", "checkout.tsx"),
  "utf8",
);
const about = fs.readFileSync(path.join(root, "app", "about.tsx"), "utf8");
const privacyData = fs.readFileSync(
  path.join(root, "app", "privacy-data.tsx"),
  "utf8",
);

describe("account navigation and profile experience", () => {
  it("keeps notification inbox and preferences as distinct destinations", () => {
    expect(drawer).toContain('label: "Notifications"');
    expect(drawer).toContain('navigate("/notifications")');
    expect(drawer).toContain('label: "Préférences de notifications"');
    expect(drawer).toContain('navigate("/notification-settings")');
  });

  it("keeps primary tickets in the tab bar and secondary account destinations in the drawer", () => {
    expect(drawer).toContain('label: "Mon profil"');
    expect(drawer).toContain('navigate("/(tabs)/profile")');
    expect(drawer).not.toContain('navigate("/(tabs)/tickets")');
    expect(drawer).toContain('navigate("/orders")');
    expect(drawer).toContain('navigate("/rewards")');
    expect(drawer).toContain('navigate("/favorites")');
    expect(drawer).toContain("rewards.availablePoints");
    expect(profile).not.toContain('label: "Mes billets"');
    expect(profile).not.toContain('label: "Mes commandes"');
    expect(tabs).toContain('title: "Mes billets"');
    expect(tabs).toContain('title: "Événements"');
  });

  it("centralizes legal documents and personal-data actions", () => {
    expect(drawer).toContain('label: "Centre légal et données"');
    expect(profile).toContain('label: "Centre légal et données"');
    expect(drawer).not.toContain('label: "Politique de confidentialité"');
    expect(privacyData).toContain('title: "Documents"');
    expect(privacyData).toContain('title: "Vos données"');
    expect(privacyData).toContain('label: "Mentions légales"');
    expect(about).not.toContain("Informations légales");
  });

  it("refreshes the Rewards ledger on focus and by pull-to-refresh", () => {
    expect(rewards).toContain("useFocusEffect");
    expect(rewards).toContain("<RefreshControl");
    expect(rewardsProvider).toContain("Promise.all");
    expect(rewardsProvider).toContain("history,");
    expect(rewardsProvider).toContain("getMobileRewardsConfig");
    expect(rewardsProvider).toContain("programConfig.redemptionTiers");
  });

  it("claims the native first-app-open campaign after authentication", () => {
    expect(mobileApi).toContain('"rewards/engagement/first-app-open"');
    expect(rewardsProvider).toContain("claimMobileFirstAppOpenBonus");
    expect(rewardsProvider).toContain(
      'Platform.OS === "ios" || Platform.OS === "android"',
    );
    expect(rewardsProvider).toContain(
      "isAuthenticated && user?.id && !isLoading",
    );
  });

  it("keeps redemption server-driven with a 500-point fallback", () => {
    expect(rewardsProvider).toContain("REDEMPTION_MIN_POINTS_LIFETIME = 500");
    expect(rewardsProvider).toContain(
      '{ points: 500, value: 10000, label: "500 pts = 10 000 Ar" }',
    );
    expect(checkout).toContain("programConfig.redemptionTiers");
    expect(checkout).not.toContain("750");
  });

  it("does not advertise unconfirmed LamakoRewards benefits", () => {
    expect(rewardsProvider).toContain("Adhésion volontaire au programme");
    expect(rewardsProvider).not.toContain("Accès backstage");
    expect(rewardsProvider).not.toContain("Meet & greet artistes");
    expect(rewardsProvider).not.toContain("Surclassement automatique");
  });

  it("uses the configured app version rather than stale screen constants", () => {
    expect(drawer).toContain("getAppVersionLabel()");
    expect(profile).toContain("getAppVersionLabel()");
    expect(drawer).not.toMatch(/TicketByLamako v2\.[05]\.0/);
    expect(profile).not.toContain("TicketByLamako v2.0.0");
  });

  it("persists the selected appearance", () => {
    expect(themeProvider).toContain("THEME_STORAGE_KEY");
    expect(themeProvider).toContain("AsyncStorage.getItem(THEME_STORAGE_KEY)");
    expect(themeProvider).toContain(
      "AsyncStorage.setItem(THEME_STORAGE_KEY, scheme)",
    );
  });

  it("saves profile identity and billing fields after the full form", () => {
    const addressSection = editProfile.indexOf("Adresse de facturation");
    const saveButton = editProfile.indexOf("Enregistrer mes informations");
    expect(addressSection).toBeGreaterThan(-1);
    expect(saveButton).toBeGreaterThan(addressSection);
    expect(editProfile).toContain('accessibilityLabel="Numéro de téléphone"');
    expect(editProfile).toContain(
      'accessibilityLabel="Adresse de facturation"',
    );
  });
});

describe("LamakoRewards catalog compatibility", () => {
  it("reads the snake_case API flag without overriding an explicit refusal", () => {
    expect(
      normalizeRewardsEnabled({ lamako_rewards_enabled: true }, false),
    ).toBe(true);
    expect(
      normalizeRewardsEnabled({ lamako_rewards_enabled: false }, true),
    ).toBe(false);
  });

  it("keeps camelCase compatibility and controlled fallbacks", () => {
    expect(normalizeRewardsEnabled({ lamakoRewardsEnabled: true }, false)).toBe(
      true,
    );
    expect(normalizeRewardsEnabled({}, false)).toBe(false);
    expect(normalizeRewardsEnabled({}, true)).toBe(true);
  });
});

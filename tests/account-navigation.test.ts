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

  it("refreshes the Rewards ledger on focus and by pull-to-refresh", () => {
    expect(rewards).toContain("useFocusEffect");
    expect(rewards).toContain("<RefreshControl");
    expect(rewardsProvider).toContain("Promise.all");
    expect(rewardsProvider).toContain("history,");
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

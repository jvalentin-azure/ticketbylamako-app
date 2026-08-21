import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("startup and onboarding experience", () => {
  it("uses one transparent logo and one background across native and React frames", () => {
    const config = read("app.config.ts");
    const loadingScreen = read("components/loading-screen.tsx");

    expect(config).toContain('image: "./assets/images/logo-white.png"');
    expect(config).toContain('backgroundColor: "#0B0908"');
    expect(config).not.toContain('image: "./assets/images/splash-icon.png"');
    expect(loadingScreen).toContain('backgroundColor: "#0B0908"');
    expect(loadingScreen).not.toContain("ActivityIndicator");
    expect(loadingScreen).not.toContain("Chargement...");
  });

  it("shows onboarding once without waiting for remote authentication", () => {
    const layout = read("app/_layout.tsx");

    expect(layout).toContain("ONBOARDING_STORAGE_KEY");
    expect(layout).toContain("ONBOARDING_VERSION");
    expect(layout).toContain("AsyncStorage.getItem");
    expect(layout).toContain("AsyncStorage.setItem");
    expect(layout).not.toContain("validateToken()");
  });

  it("keeps first use concise and respects reduced-motion settings", () => {
    const splash = read("components/splash-screen.tsx");
    const onboarding = read("components/onboarding-screen.tsx");
    const slideMatches = onboarding.match(/\{\s*id:\s*"/g);

    expect(splash).toContain("OnboardingScreen");
    expect(splash).not.toContain("WelcomeScreen");
    expect(slideMatches).toHaveLength(2);
    expect(onboarding).toContain("useReducedMotion");
    expect(onboarding).toContain("Découvrir");
    expect(onboarding).toContain("Se connecter");
  });
});

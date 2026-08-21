import { describe, it, expect } from "vitest";

/**
 * Tests for the onboarding flow structure.
 * Since we can't render React Native components in vitest,
 * we validate the data and configuration integrity.
 */

describe("Onboarding Flow", () => {
  it("should have 2 focused onboarding slides defined", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(
      __dirname,
      "../components/onboarding-screen.tsx",
    );
    const content = fs.readFileSync(onboardingPath, "utf-8");

    // Keep first use concise: value proposition then ticket utility.
    const slideMatches = content.match(/\{\s*id:\s*"/g);
    expect(slideMatches).not.toBeNull();
    expect(slideMatches!.length).toBe(2);
  });

  it("should have both onboarding background images", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const assetsDir = path.resolve(__dirname, "../assets/images");

    expect(fs.existsSync(path.join(assetsDir, "onboarding-1.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "onboarding-2.jpg"))).toBe(true);
  });

  it("splash-screen should present onboarding without a duplicate welcome step", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const splashPath = path.resolve(
      __dirname,
      "../components/splash-screen.tsx",
    );
    const content = fs.readFileSync(splashPath, "utf-8");

    expect(content).toContain("OnboardingScreen");
    expect(content).not.toContain("WelcomeScreen");
    expect(content).toContain("handleLogin");
  });

  it("onboarding slides should have French text content", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(
      __dirname,
      "../components/onboarding-screen.tsx",
    );
    const content = fs.readFileSync(onboardingPath, "utf-8");

    // Verify French content
    expect(content).toContain("Madagascar se vit");
    expect(content).toContain("toujours avec vous");
    expect(content).toContain("LamakoRewards");
    // Buttons
    expect(content).toContain("Passer");
    expect(content).toContain("Suivant");
    expect(content).toContain("Découvrir");
    expect(content).toContain("Se connecter");
  });

  it("onboarding should have parallax and fade-in animations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(
      __dirname,
      "../components/onboarding-screen.tsx",
    );
    const content = fs.readFileSync(onboardingPath, "utf-8");

    // Parallax effect
    expect(content).toContain("PARALLAX_FACTOR");
    expect(content).toContain("imageAnimatedStyle");

    // Text fade-in animation
    expect(content).toContain("textAnimatedStyle");

    // Animated dot indicators
    expect(content).toContain("DotIndicator");
    expect(content).toContain("useAnimatedScrollHandler");
  });

  it("should persist onboarding independently from authentication", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.resolve(__dirname, "../app/_layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    expect(content).toContain("ONBOARDING_STORAGE_KEY");
    expect(content).toContain("ONBOARDING_VERSION");
    expect(content).toContain("AsyncStorage.getItem");
    expect(content).toContain("AsyncStorage.setItem");
    expect(content).not.toContain("validateToken()");
  });
});

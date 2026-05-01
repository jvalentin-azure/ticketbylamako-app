import { describe, it, expect } from "vitest";

/**
 * Tests for the onboarding flow structure.
 * Since we can't render React Native components in vitest,
 * we validate the data and configuration integrity.
 */

describe("Onboarding Flow", () => {
  it("should have 4 onboarding slides defined", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(__dirname, "../components/onboarding-screen.tsx");
    const content = fs.readFileSync(onboardingPath, "utf-8");

    // Verify 4 slides are defined
    const slideMatches = content.match(/\{\s*id:\s*"/g);
    expect(slideMatches).not.toBeNull();
    expect(slideMatches!.length).toBe(4);
  });

  it("should have all 4 onboarding background images", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const assetsDir = path.resolve(__dirname, "../assets/images");

    expect(fs.existsSync(path.join(assetsDir, "onboarding-1.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "onboarding-2.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "onboarding-3.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "onboarding-4.jpg"))).toBe(true);
  });

  it("should have welcome background image", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const assetsDir = path.resolve(__dirname, "../assets/images");

    expect(fs.existsSync(path.join(assetsDir, "welcome-bg.jpg"))).toBe(true);
  });

  it("splash-screen should orchestrate onboarding then welcome with crossfade", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const splashPath = path.resolve(__dirname, "../components/splash-screen.tsx");
    const content = fs.readFileSync(splashPath, "utf-8");

    // Should import both screens
    expect(content).toContain("OnboardingScreen");
    expect(content).toContain("WelcomeScreen");

    // Should have two steps
    expect(content).toContain('"onboarding"');
    expect(content).toContain('"welcome"');

    // Should have crossfade animation
    expect(content).toContain("onboardingOpacity");
    expect(content).toContain("welcomeOpacity");
    expect(content).toContain("CROSSFADE_DURATION");

    // Should pass onBack prop to WelcomeScreen
    expect(content).toContain("onBack={handleBackToOnboarding}");
  });

  it("welcome-screen should have sign up, login, explore, and back button", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const welcomePath = path.resolve(__dirname, "../components/welcome-screen.tsx");
    const content = fs.readFileSync(welcomePath, "utf-8");

    expect(content).toContain("handleSignUp");
    expect(content).toContain("handleLogin");
    expect(content).toContain("handleExplore");
    expect(content).toContain("S'inscrire");
    expect(content).toContain("Se connecter");
    expect(content).toContain("Explorer l'application");
    // Should use existing logo, not generate a new one
    expect(content).toContain("logo-white.png");

    // Should have onBack prop and Retour button
    expect(content).toContain("onBack");
    expect(content).toContain("Retour");
    expect(content).toContain("arrow-back-ios");
  });

  it("onboarding slides should have French text content", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(__dirname, "../components/onboarding-screen.tsx");
    const content = fs.readFileSync(onboardingPath, "utf-8");

    // Verify French content
    expect(content).toContain("Découvrez");
    expect(content).toContain("meilleurs événements");
    expect(content).toContain("expériences uniques");
    expect(content).toContain("billets en un clic");
    expect(content).toContain("aucun événement");
    // Buttons
    expect(content).toContain("Passer");
    expect(content).toContain("Suivant");
    expect(content).toContain("Commencer");
  });

  it("onboarding should have parallax and fade-in animations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const onboardingPath = path.resolve(__dirname, "../components/onboarding-screen.tsx");
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

  it("onboarding auth check should show splash for non-logged-in users", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.resolve(__dirname, "../app/_layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    // Should check for valid session before deciding
    expect(content).toContain("getStoredUser");
    expect(content).toContain("getStoredToken");
    expect(content).toContain("validateToken");

    // Should show splash when no valid session
    expect(content).toContain("setShowSplash(true)");

    // Should have debug logging
    expect(content).toContain("[Onboarding]");
  });
});

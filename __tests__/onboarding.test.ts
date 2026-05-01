import { describe, it, expect } from "vitest";

/**
 * Tests for the onboarding flow structure.
 * Since we can't render React Native components in vitest,
 * we validate the data and configuration integrity.
 */

describe("Onboarding Flow", () => {
  it("should have 4 onboarding slides defined", async () => {
    // The onboarding screen exports SLIDES data internally
    // We verify the file structure is correct by importing the module
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

  it("splash-screen should orchestrate onboarding then welcome", async () => {
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
  });

  it("welcome-screen should have sign up, login, and explore actions", async () => {
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
});

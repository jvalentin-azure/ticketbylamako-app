import { describe, it, expect } from "vitest";

describe("Loading Screen", () => {
  it("loading-screen component should exist with branded elements", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const loadingPath = path.resolve(__dirname, "../components/loading-screen.tsx");
    const content = fs.readFileSync(loadingPath, "utf-8");

    // Should use the white logo
    expect(content).toContain("logo-white.png");

    // Should have dark background
    expect(content).toContain("#0a0500");

    // Should have loading text
    expect(content).toContain("Chargement...");

    // Should have ActivityIndicator with gold color
    expect(content).toContain("ActivityIndicator");
    expect(content).toContain("#c79f6c");

    // Should have pulse animation
    expect(content).toContain("pulseAnim");
    expect(content).toContain("fadeAnim");
  });

  it("_layout.tsx should use LoadingScreen instead of null", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutPath = path.resolve(__dirname, "../app/_layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    // Should import LoadingScreen
    expect(content).toContain('import { LoadingScreen } from "@/components/loading-screen"');

    // Should use LoadingScreen instead of returning null
    expect(content).toContain("return <LoadingScreen />");

    // Should NOT return null for loading states anymore
    const lines = content.split("\n");
    const loadingReturns = lines.filter(
      (line: string) =>
        line.trim().startsWith("return null") ||
        line.trim() === "return null;"
    );
    expect(loadingReturns.length).toBe(0);
  });
});

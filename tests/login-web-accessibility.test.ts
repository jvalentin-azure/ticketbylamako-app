import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const login = readFileSync(resolve("app/(auth)/login.tsx"), "utf8");

describe("mobile web login accessibility", () => {
  it("gives every critical action an explicit semantic role and name", () => {
    for (const label of [
      "Retour",
      "Continuer avec Facebook",
      "Continuer avec Google",
      "Mot de passe oublié",
      "Se connecter",
      "Créer un compte",
      "Politique de confidentialité",
    ]) {
      expect(login).toContain(`accessibilityLabel="${label}"`);
    }

    expect(
      login.match(/accessibilityRole="button"/g)?.length,
    ).toBeGreaterThanOrEqual(6);
    expect(login.match(/accessibilityRole="link"/g)?.length).toBe(2);
    expect(login).toContain('accessibilityRole="alert"');
    expect(login).toContain('accessibilityLiveRegion="assertive"');
    expect(login).toContain('accessibilityLiveRegion="polite"');
  });

  it("names the credential fields independently from their placeholders", () => {
    expect(login).toContain('accessibilityLabel="Email ou nom d\'utilisateur"');
    expect(login).toContain('accessibilityLabel="Mot de passe"');
    expect(login).toContain('autoComplete="username"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain('textContentType="username"');
    expect(login).toContain('textContentType="password"');
  });

  it("keeps the compact icon and inline actions at least 44 pixels high", () => {
    expect(login).toMatch(/passwordToggle:\s*{[\s\S]*?minHeight: 44/);
    expect(login).toMatch(/forgotPasswordButton:\s*{[\s\S]*?minHeight: 44/);
    expect(login).toMatch(/inlineLink:\s*{[\s\S]*?minHeight: 44/);
    expect(login).toMatch(/privacyLink:\s*{[\s\S]*?minHeight: 44/);
  });
});

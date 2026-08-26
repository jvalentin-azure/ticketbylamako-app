import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("native session restoration", () => {
  it("restores an unexpired encrypted session before remote validation", () => {
    const provider = read("lib/auth-provider.tsx");

    expect(provider).toContain("Promise.all");
    expect(provider).toContain("isJwtLocallyUsable(token)");
    expect(provider).toContain(
      "setState({ user, isLoading: false, isAuthenticated: true })",
    );
    expect(provider.indexOf("isJwtLocallyUsable(token)")).toBeLessThan(
      provider.indexOf("void validateToken(token)"),
    );
  });

  it("keeps JWT storage encrypted on native platforms", () => {
    const auth = read("lib/api/auth.ts");
    const socialAuth = read("lib/api/social-auth.ts");

    expect(auth).toContain("SecureStore.setItemAsync");
    expect(auth).toContain("SecureStore.getItemAsync");
    expect(auth).toContain("NATIVE_STORAGE_RETRY_DELAYS_MS");
    expect(socialAuth).toContain('await import("expo-secure-store")');
    expect(auth).not.toContain("AsyncStorage.setItem(TOKEN_KEY");
    expect(socialAuth).not.toContain("AsyncStorage.setItem(TOKEN_KEY");
  });
});

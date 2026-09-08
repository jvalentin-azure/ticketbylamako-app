import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("Apple App Review remediation", () => {
  it("offers Apple on iOS without exposing unvalidated Google or Facebook actions", () => {
    const login = readFileSync(resolve(root, "app/(auth)/login.tsx"), "utf8");

    expect(login).toContain("AppleAuthentication.AppleAuthenticationButton");
    expect(login).toContain('Platform.OS !== "ios"');
  });

  it("offers the same verified social providers during registration", () => {
    const register = readFileSync(
      resolve(root, "app/(auth)/register.tsx"),
      "utf8",
    );
    const social = readFileSync(
      resolve(root, "components/auth/social-auth-buttons.tsx"),
      "utf8",
    );

    expect(register).toContain("<SocialAuthButtons");
    expect(social).toContain('handleProvider("apple")');
    expect(social).toContain('handleProvider("google")');
    expect(social).toContain('handleProvider("facebook")');
    expect(social).toContain("socialLogin(provider, credential)");
  });

  it("initiates authenticated account deletion directly from the app", () => {
    const privacyData = readFileSync(
      resolve(root, "app/privacy-data.tsx"),
      "utf8",
    );
    const authApi = readFileSync(resolve(root, "lib/api/auth.ts"), "utf8");

    expect(privacyData).toContain("requestAccountDeletion()");
    expect(authApi).toContain(
      "ticketbylamako-compliance/v1/account-deletion-requests",
    );
    expect(authApi).toContain("Authorization: `Bearer ${token}`");
  });
});

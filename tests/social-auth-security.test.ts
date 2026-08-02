import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const socialAuth = fs.readFileSync(
  path.join(root, "lib/api/social-auth.ts"),
  "utf8",
);
const loginScreen = fs.readFileSync(
  path.join(root, "app/(auth)/login.tsx"),
  "utf8",
);
const eventScreen = fs.readFileSync(
  path.join(root, "app/event/[id].tsx"),
  "utf8",
);
const appConfig = fs.readFileSync(path.join(root, "app.config.ts"), "utf8");

describe("social authentication security", () => {
  it("uses cryptographic state and nonce instead of Math.random", () => {
    expect(socialAuth).toContain("Crypto.getRandomBytesAsync");
    expect(socialAuth).not.toContain("Math.random");
    expect(socialAuth).toContain("nonce");
  });

  it("uses a signed Google OpenID Connect token", () => {
    expect(socialAuth).toContain('response_type: "id_token"');
    expect(socialAuth).toContain('scope: "openid email profile"');
  });

  it("uses the official Apple button and entitlement configuration", () => {
    expect(loginScreen).toContain("AppleAuthenticationButton");
    expect(loginScreen).toContain("AppleAuthentication.isAvailableAsync");
    expect(appConfig).toContain("usesAppleSignIn: true");
    expect(appConfig).toContain('"expo-apple-authentication"');
  });

  it("does not place the WordPress JWT in a WebView URL", () => {
    expect(eventScreen).not.toContain("/auto-login?token=");
    expect(eventScreen).toContain('mixedContentMode="never"');
  });
});

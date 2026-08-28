import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const socialAuth = fs.readFileSync(
  path.join(root, "lib/api/social-auth.ts"),
  "utf8",
);
const socialButtons = fs.readFileSync(
  path.join(root, "components/auth/social-auth-buttons.tsx"),
  "utf8",
);
const socialServer = fs.readFileSync(
  path.join(
    root,
    "scripts/lamako-mobile-api/includes/social-auth-security.php",
  ),
  "utf8",
);
const seatingFlow = fs.readFileSync(
  path.join(root, "components/seating/SeatPurchaseFlow.tsx"),
  "utf8",
);
const appConfig = fs.readFileSync(path.join(root, "app.config.ts"), "utf8");

describe("social authentication security", () => {
  it("keeps browser OAuth callbacks on the HTTPS mobile site", () => {
    expect(socialAuth).toContain('Platform.OS === "web"');
    expect(socialAuth).toContain("/mobile/oauth/${provider}-callback");
    expect(socialAuth).toContain('getOAuthAppReturnUrl("google")');
    expect(socialAuth).toContain('getOAuthAppReturnUrl("facebook")');
  });

  it("drops the previous REST nonce before the Apple cookie handoff", () => {
    const appleStart = socialAuth.slice(
      socialAuth.indexOf("export async function startAppleLogin"),
      socialAuth.indexOf("export async function startFacebookLogin"),
    );
    expect(appleStart).toContain("clearWebSessionNonce()");
    expect(appleStart.indexOf("clearWebSessionNonce()")).toBeLessThan(
      appleStart.indexOf("window.location.assign"),
    );
  });

  it("does not call the retired Facebook Graph API v18", () => {
    expect(socialAuth).toContain('FACEBOOK_GRAPH_VERSION = "v24.0"');
    expect(socialAuth).not.toContain("facebook.com/v18.0");
    expect(socialServer).toContain("graph.facebook.com/v24.0");
    expect(socialServer).not.toContain("graph.facebook.com/v18.0");
  });

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
    expect(socialButtons).toContain("AppleAuthenticationButton");
    expect(socialButtons).toContain("AppleAuthentication.isAvailableAsync");
    expect(appConfig).toContain("usesAppleSignIn: true");
    expect(appConfig).toContain('"expo-apple-authentication"');
  });

  it("does not place the WordPress JWT in a WebView URL", () => {
    expect(seatingFlow).not.toContain("/auto-login?token=");
    expect(seatingFlow).toContain('mixedContentMode="never"');
  });
});

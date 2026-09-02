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
const oauthCallbackPage = fs.readFileSync(
  path.join(root, "scripts/lamako-mobile-api.php"),
  "utf8",
);
const facebookWebAuth = fs.readFileSync(
  path.join(
    root,
    "scripts/lamako-mobile-api/includes/web-facebook-auth.php",
  ),
  "utf8",
);

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
    expect(appleStart).toContain("prepareForExternalAuth()");
    expect(appleStart.indexOf("prepareForExternalAuth()")).toBeLessThan(
      appleStart.indexOf("window.location.assign"),
    );
  });

  it("completes browser Facebook OAuth on WordPress", () => {
    const facebookStart = socialAuth.slice(
      socialAuth.indexOf("export async function startFacebookLogin"),
    );
    expect(facebookStart).toContain('action", "lamako_facebook_start"');
    expect(facebookStart).toContain("prepareForExternalAuth()");
    expect(facebookStart.indexOf("prepareForExternalAuth()"))
      .toBeLessThan(facebookStart.indexOf("window.location.assign"));
    expect(facebookWebAuth).toContain("response_type' => 'code'");
    expect(facebookWebAuth).toContain("lamako_web_facebook_consume_session");
    expect(facebookWebAuth).toContain("browser_nonce_hash");
    expect(facebookWebAuth).toContain("'httponly' => true");
    expect(facebookWebAuth).toContain("'samesite' => 'Lax'");
    expect(facebookWebAuth).toContain("lamako_web_facebook_validate_redirect");
    expect(facebookWebAuth).toContain("lamako_mobile_validate_facebook_identity");
    expect(facebookWebAuth).toContain("wp_set_auth_cookie");
    expect(facebookWebAuth).not.toContain("access_token=' .");
  });

  it("confirms the browser cookie session after social login", () => {
    expect(socialAuth).toContain("confirmAuthenticatedUser(data.user.id)");
    expect(socialAuth).not.toContain("const valid = await validateToken()");
  });

  it("uses the mobile website as the safe callback fallback", () => {
    expect(oauthCallbackPage).toContain("isWebReturn");
    expect(oauthCallbackPage).toContain("Continuer sur TicketByLamako");
    expect(oauthCallbackPage).toContain(
      "Retour automatique vers TicketByLamako.",
    );
    expect(oauthCallbackPage).toContain("var appUrl = defaultWebUrl");
    expect(oauthCallbackPage).toContain("appUrl = defaultWebUrl");
    expect(oauthCallbackPage).not.toContain("var appUrl = defaultAppUrl");
  });

  it("recovers OAuth state from either the query or URL fragment", () => {
    expect(oauthCallbackPage).toContain(
      "var suffix = query + fragment",
    );
    expect(oauthCallbackPage).toContain("fragmentParams.get(name)");
    expect(oauthCallbackPage).toContain("queryParams.get(name)");
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

  it("rejects non-JSON social responses before they reach React Native JSON parsing", () => {
    const socialLoginFlow = socialAuth.slice(
      socialAuth.indexOf("type SocialApiError"),
      socialAuth.indexOf("export async function startGoogleLogin"),
    );
    expect(socialLoginFlow).toContain("parseSocialApiResponse");
    expect(socialLoginFlow).toContain("await response.text()");
    expect(socialLoginFlow).toContain("une page HTML");
    expect(socialLoginFlow).not.toContain("await res.json()");
  });

  it("keeps the WordPress social-login response free of echoed HTML", () => {
    expect(oauthCallbackPage).toContain(
      "'callback' => 'lamako_mobile_social_login_json_guard'",
    );
    expect(oauthCallbackPage).toContain("ob_start()");
    expect(oauthCallbackPage).toContain("Suppressed unexpected output");
    expect(oauthCallbackPage).toContain("social_login_server_error");
  });

  it("does not place the WordPress JWT in a WebView URL", () => {
    expect(seatingFlow).not.toContain("/auto-login?token=");
    expect(seatingFlow).toContain('mixedContentMode="never"');
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appConfig = readFileSync(resolve("app.config.ts"), "utf8");
const webAuth = readFileSync(resolve("lib/api/auth.web.ts"), "utf8");
const mobileApi = readFileSync(resolve("lib/api/mobile.ts"), "utf8");
const webSession = readFileSync(resolve("lib/api/web-session.web.ts"), "utf8");
const socialAuth = readFileSync(resolve("lib/api/social-auth.ts"), "utf8");
const commerce = readFileSync(
  resolve("scripts/lamako-mobile-api/includes/v2-commerce.php"),
  "utf8",
);
const seatingFrame = readFileSync(
  resolve("components/seating/seating-browser-frame.web.tsx"),
  "utf8",
);
const eventDetail = readFileSync(resolve("app/event/[id].tsx"), "utf8");
const calendar = readFileSync(resolve("lib/event-calendar.web.ts"), "utf8");
const commerceBrowser = readFileSync(
  resolve("lib/commerce-browser.web.ts"),
  "utf8",
);
const wallet = readFileSync(resolve("lib/native-wallet.web.ts"), "utf8");
const wordpressRouter = readFileSync(
  resolve("scripts/lamako-mobile-api/includes/mobile-web-router.php"),
  "utf8",
);
const apacheRules = readFileSync(resolve("public/.htaccess"), "utf8");
const webAlert = readFileSync(resolve("lib/platform-alert.web.ts"), "utf8");
const alertConsumers = [
  "app/about.tsx",
  "app/checkout.tsx",
  "app/edit-profile.tsx",
  "app/event/[id].tsx",
  "app/help.tsx",
  "app/notification-settings.tsx",
  "app/notifications.tsx",
  "app/payment.tsx",
  "app/privacy-data.tsx",
  "app/ticket/[id].tsx",
  "app/(tabs)/cart.tsx",
  "app/(tabs)/profile.tsx",
  "components/commerce/CheckoutSteps.tsx",
  "components/drawer-content.tsx",
  "components/organizer-event-cta.tsx",
  "components/seating/SeatPurchaseFlow.tsx",
  "lib/cart-provider.tsx",
].map((path) => readFileSync(resolve(path), "utf8"));

describe("non-installable mobile web foundation", () => {
  it("exports an Expo Router SPA below the WordPress /mobile path", () => {
    expect(appConfig).toContain('output: "single"');
    expect(appConfig).toContain('EXPO_PUBLIC_WEB_BASE_URL || "/mobile"');
    expect(appConfig).toContain("baseUrl: webBaseUrl");
  });

  it("does not ship PWA installation primitives", () => {
    expect(existsSync(resolve("public/manifest.json"))).toBe(false);
    expect(existsSync(resolve("public/manifest.webmanifest"))).toBe(false);
    expect(existsSync(resolve("public/service-worker.js"))).toBe(false);
    expect(existsSync(resolve("public/sw.js"))).toBe(false);
  });

  it("ships an SPA fallback and browser security headers", () => {
    expect(apacheRules).toContain("RewriteRule . /mobile/index.html [L]");
    expect(apacheRules).toContain("Content-Security-Policy");
    expect(apacheRules).toContain("Strict-Transport-Security");
    expect(apacheRules).toContain("script-src 'self'");
    expect(apacheRules).toContain("object-src 'none'");
    expect(apacheRules).toContain("X-Content-Type-Options");
    expect(apacheRules).toContain("no-cache, no-store, must-revalidate");
  });

  it("keeps browser credentials in HttpOnly WordPress cookies", () => {
    expect(webAuth).toContain('credentials: "include"');
    expect(webAuth).toContain('headers["X-WP-Nonce"] = nonce');
    expect(webAuth).toContain("wordpress-cookie-session");
    expect(webAuth).not.toContain("AsyncStorage");
    expect(webAuth).not.toContain("SecureStore");
    expect(webAuth).not.toContain('const TOKEN_KEY = "jwt_token"');
    expect(webAuth).toContain("confirmAuthenticatedUser(data.user.id)");
    expect(webAuth).toContain("requestEpoch !== sessionEpoch");
    expect(webAuth).toContain("requestSessionWithNonceRecovery");
    expect(webAuth).toContain(
      'errorData.code === "rest_cookie_invalid_nonce"',
    );
    expect(socialAuth).toContain("v2/web-session/social");
    expect(socialAuth).toContain("confirmAuthenticatedUser(data.user.id)");
    expect(socialAuth).toContain("session WordPress HttpOnly");
  });

  it("uses cookies and a REST nonce for protected v2 browser requests", () => {
    expect(mobileApi).toContain('Platform.OS === "web"');
    expect(mobileApi).toContain('headers["X-WP-Nonce"] = nonce');
    expect(mobileApi).toContain(
      'credentials: usesWebCookieSession ? "include" : undefined',
    );
    expect(mobileApi).toContain("token && !usesWebCookieSession");
    expect(mobileApi).toContain(
      "requireAuth && !usesWebCookieSession ? await getStoredToken() : null",
    );
    expect(mobileApi).toContain(
      "requireAuth && !usesWebCookieSession && !token",
    );
    expect(mobileApi).toContain('errorBody.code === "rest_cookie_invalid_nonce"');
    expect(mobileApi).toContain("await refreshWebSessionNonce()");
    expect(webSession).toContain('credentials: "include"');
    expect(webSession).toContain('cache: "no-store"');
    expect(webSession).toContain("if (refreshRequest) return refreshRequest");
    expect(webSession).toContain("refreshEpoch === nonceEpoch");
    expect(webSession).toContain("controller.abort()");
  });

  it("provides same-origin, rate-limited WordPress web sessions", () => {
    expect(commerce).toContain("'/web-session/login'");
    expect(commerce).toContain("'/web-session/register'");
    expect(commerce).toContain("'/web-session/logout'");
    expect(commerce).toContain("lamako_mobile_v2_allow_same_origin_web_auth");
    expect(commerce).toContain("lamako_mobile_v2_web_auth_rate_limit");
    expect(commerce).toContain("hash_equals( $site_scheme, $source_scheme )");
    expect(commerce).toContain("$site_port === $source_port");
    expect(commerce).toContain("wp_validate_auth_cookie( '', 'logged_in' )");
    expect(commerce).toContain("wp_create_nonce( 'wp_rest' )");
    expect(commerce).toContain(
      "wp_set_auth_cookie( $user_id, true, is_ssl() )",
    );
  });

  it("keeps critical ticket journeys inside the mobile browser experience", () => {
    expect(seatingFrame).toContain("Plan de salle interactif");
    expect(seatingFrame).toContain("allow-same-origin allow-scripts");
    expect(existsSync(resolve("components/seating/seating-browser-frame.ts"))).toBe(
      false,
    );
    expect(
      existsSync(resolve("components/seating/seating-browser-frame.native.ts")),
    ).toBe(true);
    expect(
      existsSync(resolve("components/seating/seating-browser-frame.d.ts")),
    ).toBe(true);
    expect(eventDetail).toContain("isLoading: isAuthLoading");
    expect(eventDetail).toContain(
      "seatingLoading || isAuthLoading || eventClosed",
    );
    expect(calendar).toContain('type: "text/calendar;charset=utf-8"');
    expect(calendar).toContain("BEGIN:VALARM");
    expect(wallet).toContain("window.location.assign");
    expect(commerceBrowser).toContain("ticketbylamako-payment");
    expect(commerceBrowser).toContain("ticketbylamako_web_payment");
    expect(commerceBrowser).toContain("popup.opener = null");
    expect(commerceBrowser).toContain("WEB_PAYMENT_COMPLETED_KEY");
    expect(commerceBrowser).not.toContain(
      "`${WEB_PAYMENT_STORAGE_KEY}${flowToken}`",
    );
    expect(commerce).toContain("home_url( '/mobile/payment-return' )");
  });

  it("keeps confirmations and error alerts actionable in the browser", () => {
    expect(webAlert).toContain('role", "alertdialog"');
    expect(webAlert).toContain('aria-modal", "true"');
    expect(webAlert).toContain("action.onPress?.()");
    expect(webAlert).toContain('event.key === "Escape"');
    expect(
      alertConsumers.every((source) =>
        source.includes('from "@/lib/platform-alert"'),
      ),
    ).toBe(true);
  });

  it("switches phone visitors without replacing desktop WordPress", () => {
    expect(wordpressRouter).toContain("(max-width: 820px)");
    expect(wordpressRouter).toContain("window.location.replace");
    expect(wordpressRouter).toContain("ticketbylamako_desktop_session");
    expect(wordpressRouter).toContain("LAMAKO_MOBILE_WEB_ENABLED");
    expect(wordpressRouter).toContain("LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT");
    expect(wordpressRouter).toContain("ticketbylamako_mobile_web_bucket");
    expect(wordpressRouter).toContain("google-inspectiontool");
    expect(wordpressRouter).toContain("is_singular( 'product' )");
    expect(wordpressRouter).toContain("is_singular( 'tc_events' )");
    expect(wordpressRouter).toContain("'/mobile/product/'");
    expect(wordpressRouter).toContain("'/mobile/event/'");
    expect(wordpressRouter).toContain("'/checkout'");
    expect(wordpressRouter).toContain("'/lamako-mobile'");
    expect(wordpressRouter).not.toContain("wp_safe_redirect");
  });
});

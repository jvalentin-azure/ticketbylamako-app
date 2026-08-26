import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const wallet = fs.readFileSync(
  path.join(root, "scripts/lamako-mobile-api/includes/v2-wallet.php"),
  "utf8",
);
const commerce = fs.readFileSync(
  path.join(root, "scripts/lamako-mobile-api/includes/v2-commerce.php"),
  "utf8",
);
const ticketScreen = fs.readFileSync(
  path.join(root, "app/ticket/[id].tsx"),
  "utf8",
);
const nativeWallet = fs.readFileSync(
  path.join(root, "lib/native-wallet.ts"),
  "utf8",
);
const webWallet = fs.readFileSync(
  path.join(root, "lib/native-wallet.web.ts"),
  "utf8",
);
const appConfig = fs.readFileSync(path.join(root, "app.config.ts"), "utf8");
const bundledWalletLogo = path.join(
  root,
  "scripts/lamako-mobile-api/assets/wallet-logo.png",
);

describe("server-signed ticket wallet passes", () => {
  it("requires authentication, order ownership and a paid ticket", () => {
    expect(wallet).toContain(
      "'permission_callback' => 'lamako_mobile_v2_require_user'",
    );
    expect(wallet).toContain("lamako_mobile_v2_is_order_owner( $order )");
    expect(wallet).toContain(
      "lamako_mobile_v2_order_allows_ticket_display( $order )",
    );
    expect(wallet).toContain(
      "lamako_mobile_v2_get_tickets_for_order( $order )",
    );
  });

  it("keeps private signing material outside the web root", () => {
    expect(wallet).toContain("lamako_mobile_v2_wallet_path_is_private");
    expect(wallet).toContain("LAMAKO_WALLET_APPLE_KEY_PATH");
    expect(wallet).toContain("LAMAKO_WALLET_GOOGLE_SERVICE_ACCOUNT_PATH");
    expect(wallet).not.toMatch(/BEGIN (RSA )?PRIVATE KEY/);
  });

  it("signs Apple passes and Google save JWTs on the server", () => {
    expect(wallet).toContain("application/vnd.apple.pkpass");
    expect(wallet).toContain("manifest.json");
    expect(wallet).toContain("openssl_cms_sign");
    expect(wallet).toContain("openssl_sign");
    expect(wallet).toContain("https://pay.google.com/gp/v/save/");
  });

  it("serves a reusable byte-exact Apple pass for Wallet validation", () => {
    expect(wallet).not.toContain("delete_transient( 'lamako_apple_wallet_'");
    expect(wallet).toContain("'pass'      => base64_encode( $pass )");
    expect(wallet).toContain("base64_decode( (string) ( $record['pass']");
    expect(wallet).toContain("while ( ob_get_level() > 0 )");
    expect(wallet).toContain("header( 'Content-Length: ' . strlen( $pass ) )");
    expect(wallet).toContain("X-Content-Type-Options: nosniff");
  });

  it("exposes provider availability without returning signing secrets", () => {
    expect(commerce).toContain("'appleWalletAvailable'");
    expect(commerce).toContain("'googleWalletAvailable'");
    expect(ticketScreen).toContain("getMobileTicketWalletLink");
    expect(ticketScreen).toContain("walletAvailable");
  });

  it("returns to the app through the native Wallet controllers", () => {
    expect(ticketScreen).toContain("addTicketToNativeWallet");
    expect(ticketScreen).not.toContain("Linking.openURL(response.url)");
    expect(ticketScreen).not.toContain("legacyWalletUrl");
    expect(nativeWallet).toContain("WalletKitModule.canAddPasses()");
    expect(nativeWallet).toContain("WalletKitModule.addPass(passData)");
    expect(nativeWallet).toContain("application/vnd.apple.pkpass");
    expect(nativeWallet).toContain("/gp/v/save/");
    expect(appConfig).toContain("./plugins/with-wallet-kit");
  });

  it("keeps the native Wallet SDK out while handing signed links to the browser", () => {
    expect(webWallet).not.toContain("@azizuysal/wallet-kit");
    expect(webWallet).toContain('url.protocol !== "https:"');
    expect(webWallet).toContain("window.location.assign");
    expect(ticketScreen).toContain("webPrefersAppleWallet");
    expect(ticketScreen).toContain("walletPlatform");
  });

  it("uses only local WordPress media for the premium Apple strip", () => {
    expect(wallet).toContain("get_post_thumbnail_id");
    expect(wallet).toContain("attachment_url_to_postid");
    expect(wallet).toContain("wp_get_upload_dir");
    expect(wallet).toContain("wp_get_image_editor");
    expect(wallet).toContain("strip@2x.png");
    expect(wallet).toContain("'strip.png'    => [ 375, 98 ]");
    expect(wallet).toContain("'strip@2x.png' => [ 750, 196 ]");
    expect(wallet).not.toContain("strip@3x.png");
    expect(wallet).toContain("suppressStripShine");
    expect(wallet).toContain("'ticketId'");
    expect(wallet).toContain("'ticketbylamako://ticket/' . $order->get_id()");
  });

  it("brands Apple and Google passes with the TicketByLamako logo", () => {
    expect(wallet).toContain("lamako_mobile_v2_wallet_brand_logo_url");
    expect(wallet).toContain("get_theme_mod( 'custom_logo' )");
    expect(wallet).toContain("assets/wallet-logo.png");
    expect(fs.existsSync(bundledWalletLogo)).toBe(true);
    expect(wallet).toContain("$template_version = 'v2'");
    expect(wallet).toContain("'logo@2x.png'");
    expect(wallet).toContain("$class['logo']");
    expect(wallet).toContain("Logo TicketByLamako");
  });
});

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
});

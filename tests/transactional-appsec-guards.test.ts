import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const rewards = read("scripts/lamako-rewards-api/lamako-rewards-api.php");
const commerce = read("scripts/lamako-mobile-api/includes/v2-commerce.php");
const orangeGuard = read("scripts/tbl-orange-callback-guard.php");
const stagingOrangeQa = read("scripts/qa-staging-orange-security.php");
const rewardsProvider = read("lib/rewards-provider.tsx");
const stagingRewardsQa = read("scripts/qa-staging-rewards-security.php");

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("transactional AppSec guards", () => {
  it("binds all legacy user-scoped Rewards routes to a user JWT", () => {
    expect(rewards).toContain("function lr_rest_require_user( $request )");
    expect(rewards).toContain("true === $auth");
    expect(rewards).toContain("function lr_authenticated_user_id(");
    expect(rewards).toContain("$claimed_user_id !== $user_id");
    expect(
      rewards.match(/'permission_callback' => 'lr_rest_require_user'/g),
    ).toHaveLength(7);
    expect(rewards).toContain(
      "$user_id = lr_authenticated_user_id( $request, $body['user_id'] ?? 0 )",
    );
    expect(rewards).toContain(
      "$referee_user_id = lr_authenticated_user_id( $request, $body['referee_user_id'] ?? 0 )",
    );
  });

  it("serializes and atomically commits coupon redemption", () => {
    const redemption = section(
      rewards,
      "function lr_redeem_points_for_user(",
      "// ============================================================\n// HELPER FUNCTIONS",
    );

    expect(rewards).toContain("SHOW TABLE STATUS WHERE Name = %s");
    expect(rewards).toContain("'INNODB'");
    expect(redemption).toContain("SELECT GET_LOCK(%s, %d)");
    expect(redemption).toContain("START TRANSACTION");
    expect(redemption).toContain("FOR UPDATE");
    expect(redemption).toContain("lr_rewards_redemption_value");
    expect(redemption).toContain("lr_rewards_minimum_redeem_points");
    expect(redemption).toContain("add_option( $context['option_name']");
    expect(rewards).toContain("idempotency_record_invalid");
    expect(redemption).toContain("set_email_restrictions");
    expect(redemption).toContain("_lamako_rewards_idempotency_hash");
    expect(redemption).toContain("$deducted = mycred_subtract(");
    expect(redemption).toContain("COMMIT");
    expect(redemption).toContain("ROLLBACK");
    expect(redemption).toContain("SELECT RELEASE_LOCK(%s)");
  });

  it("makes idempotency mandatory and reuses the secure Rewards backend", () => {
    const v2Redemption = section(
      commerce,
      "function lamako_mobile_v2_rewards_redeem(",
      "function lamako_mobile_v2_referral_code(",
    );

    expect(rewards).toContain("A valid Idempotency-Key is required");
    expect(v2Redemption).toContain("get_header( 'Idempotency-Key' )");
    expect(v2Redemption).toContain("lr_redeem_points_for_user(");
    expect(v2Redemption).not.toContain("mycred_subtract(");
    expect(v2Redemption).not.toContain("new WC_Coupon()");
    expect(rewardsProvider).toContain(
      'import { randomUUID } from "expo-crypto"',
    );
    expect(rewardsProvider).toContain("redemptionKeysRef");
    expect(rewardsProvider).toContain(
      "redeemMobileRewards(points, idempotencyKey)",
    );
  });

  it("uses one hardened Orange gateway for WooCommerce and Mobile v2", () => {
    const availability = section(
      commerce,
      "function lamako_mobile_v2_orange_server_verification_available()",
      "function lamako_mobile_v2_initiate_orange(",
    );
    const initiation = section(
      commerce,
      "function lamako_mobile_v2_initiate_orange(",
      "function lamako_mobile_v2_json_response(",
    );
    const callback = section(
      commerce,
      "function lamako_mobile_v2_orange_callback(",
      "function lamako_mobile_v2_reconcile_pending_payments(",
    );
    const secureCallback = section(
      orangeGuard,
      "function tbl_orange_secure_webhook(",
      "function tbl_orange_check_status_permission(",
    );

    expect(availability).toContain("tbl_orange_gateway_is_hardened");
    expect(availability).toContain("lamako_mobile_v2_provider_gateway(");
    expect(commerce).toContain(
      "'papi_paiement' === $gateway_id && ! lamako_mobile_v2_orange_server_verification_available()",
    );
    expect(commerce).toContain("lamako_v2_orange_verification_unavailable");
    expect(initiation).toContain("lamako_mobile_v2_invoke_gateway(");
    expect(initiation).not.toContain("wp_remote_post(");
    expect(initiation).not.toContain("_papi_notif_token");
    expect(callback).toContain("tbl_orange_secure_webhook( $request )");
    expect(callback).not.toContain("payment_complete(");
    expect(callback).not.toContain("update_status(");

    expect(orangeGuard).toContain("class TBL_Secure_Orange_Gateway");
    expect(orangeGuard).toContain("function tbl_security_ready()");
    expect(orangeGuard).toContain("rest_url( 'papi/v1/webhook' )");
    expect(orangeGuard).toContain("_tbl_papi_notif_token_hash");
    expect(orangeGuard).toContain("_tbl_orange_expected_amount");
    expect(orangeGuard).toContain("_tbl_orange_expected_currency");
    expect(orangeGuard).toContain("_tbl_orange_token_expires_at");
    expect(orangeGuard).toContain("delete_meta_data( '_papi_notif_token' )");
    expect(secureCallback).toContain("tbl_orange_callback_rate_limit(");
    expect(secureCallback).toContain("tbl_orange_gateway_lock(");
    expect(secureCallback).toContain("tbl_orange_validate_callback_snapshot(");
    expect(secureCallback).toContain("[ 'cancelled', 'refunded', 'failed' ]");
    expect(secureCallback).toContain("$order->payment_complete( $transaction_id )");
    expect(secureCallback).toContain("idempotent_replay");
    expect(secureCallback).not.toContain("update_status( 'completed'");
    expect(secureCallback).not.toContain("wc_maybe_increase_stock_levels(");
  });

  it("keeps the staging Rewards smoke synthetic and self-cleaning", () => {
    expect(stagingRewardsQa).toContain(
      "Refusing to run Rewards QA outside TicketByLamako staging",
    );
    expect(stagingRewardsQa).toContain("idempotent_replay");
    expect(stagingRewardsQa).toContain("409 === $conflict->get_status()");
    expect(stagingRewardsQa).toContain("403 === $other_user->get_status()");
    expect(stagingRewardsQa).toContain("delete_option( $idempotency_option )");
    expect(stagingRewardsQa).toContain("wp_delete_user( $user_id )");
  });

  it("keeps the staging Orange smoke payment-free and self-cleaning", () => {
    expect(stagingOrangeQa).toContain(
      "Refusing to run Orange QA outside TicketByLamako staging",
    );
    expect(stagingOrangeQa).toContain(
      "TBL_QA_ALLOW_ORANGE_INITIATION",
    );
    expect(stagingOrangeQa).toContain("TBL_QA_ORANGE_CREDENTIAL_ENV");
    expect(stagingOrangeQa).toContain(
      "independently confirmed non-production/test",
    );
    expect(stagingOrangeQa).toContain("WC_Order_Item_Fee");
    expect(stagingOrangeQa).toContain("! $order->is_paid()");
    expect(stagingOrangeQa).toContain("_tbl_papi_notif_token_hash");
    expect(stagingOrangeQa).toContain("'' === (string) $order->get_meta( '_papi_notif_token' )");
    expect(stagingOrangeQa).toContain("$fixture->delete( true )");
    expect(stagingOrangeQa).toContain("$orders_after !== $orders_before");
    expect(stagingOrangeQa).not.toContain("payment_complete(");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const rewards = read("scripts/lamako-rewards-api/lamako-rewards-api.php");
const commerce = read("scripts/lamako-mobile-api/includes/v2-commerce.php");
const rewardsProvider = read("lib/rewards-provider.tsx");

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

  it("fails Orange closed until authenticated provider verification exists", () => {
    const availability = section(
      commerce,
      "function lamako_mobile_v2_orange_server_verification_available()",
      "function lamako_mobile_v2_orange_token(",
    );
    const callback = section(
      commerce,
      "function lamako_mobile_v2_orange_callback(",
      "function lamako_mobile_v2_reconcile_pending_payments(",
    );

    expect(availability).toContain("return false;");
    expect(commerce).toContain(
      "'papi_paiement' === $gateway_id && ! lamako_mobile_v2_orange_server_verification_available()",
    );
    expect(commerce).toContain("lamako_v2_orange_verification_unavailable");
    expect(callback).toContain("hash_hmac(");
    expect(callback).toContain("$previous_hash");
    expect(callback).toContain("$amount_mismatch");
    expect(callback).toContain("$currency_mismatch");
    expect(callback).toContain("lamako_mobile_v2_mark_payment_for_review(");
    expect(callback).not.toContain("payment_complete(");
    expect(callback).not.toContain("update_status(");
    expect(callback).not.toContain("lamako_mobile_v2_provider_failure(");
    expect(callback).not.toContain("lamako_mobile_v2_cancel_unpaid_payment(");
  });
});

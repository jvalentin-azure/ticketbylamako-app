import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const commerce = fs.readFileSync(
  path.join(root, "scripts/lamako-mobile-api/includes/v2-commerce.php"),
  "utf8",
);
const expiryGuard = fs.readFileSync(
  path.join(root, "scripts/tbl-mobile-order-expiry-guard.php"),
  "utf8",
);

describe("mobile ticket issuance integrity", () => {
  it("creates Tickera instances only after server-confirmed payment", () => {
    expect(commerce).toContain(
      "if ( lamako_mobile_v2_order_allows_ticket_display( $order ) )",
    );
    expect(commerce).toContain(
      "add_action( 'woocommerce_payment_complete', 'lamako_mobile_v2_issue_tickets_after_payment'",
    );
    expect(commerce).toContain(
      "add_action( 'woocommerce_order_status_changed', 'lamako_mobile_v2_issue_tickets_after_payment'",
    );
  });

  it("recognizes the trusted CyberSource completion status", () => {
    expect(commerce).toContain(
      "'cybersource' === $order->get_payment_method()",
    );
    expect(commerce).toContain("'cs-complete' === $order->get_status()");
    expect(commerce).toContain(
      "return lamako_mobile_v2_payment_is_confirmed( $order );",
    );
  });

  it("rebuilds seat assignments after payment without relying on a browser cookie", () => {
    expect(commerce).toContain(
      "function lamako_mobile_v2_get_item_seat_assignments",
    );
    expect(commerce).toContain("'_lamako_seat_labels'");
    expect(commerce).toContain("'_lamako_seat_ids'");
    expect(commerce).toContain("'_lamako_chart_ids'");
    expect(commerce).toContain(
      "Persist the assignment before payment so the status-change hook can",
    );
  });

  it("expands one Tickera chart ID across a multi-seat selection", () => {
    expect(commerce).toContain("count( $charts ) === 1 && count( $ids ) > 1");
    expect(commerce).toContain("array_fill( 0, count( $ids ), $charts[0] )");
    expect(commerce).toContain(
      "array_fill( 0, count( $seat_ids ), $chart_ids[0] )",
    );
  });

  it("exposes a reservation deadline even when legacy expiry metadata is absent", () => {
    expect(commerce).toContain(
      "lamako_mobile_v2_order_reservation_deadline( $order )",
    );
    expect(commerce).toContain("gmdate( 'c', $reservation_deadline )");
  });

  it("never extends the cart hold when checkout starts", () => {
    expect(commerce).toContain("$body['reservationExpiresAt']");
    expect(commerce).toContain(
      "$expires_at = min( $expires_at, (int) $requested_expiry )",
    );
    expect(commerce).toContain("lamako_v2_reservation_expired");
  });

  it("cancels only expired unpaid orders after a final fresh read", () => {
    expect(commerce).toContain("function lamako_mobile_v2_expire_stale_orders");
    expect(commerce).toContain(
      "$fresh_order = wc_get_order( $order->get_id() );",
    );
    expect(commerce).toContain(
      "lamako_mobile_v2_void_unpaid_ticket_instances( $fresh_order )",
    );
    expect(commerce).toContain(
      "lamako_mobile_v2_release_expired_order_seats( $fresh_order )",
    );
    expect(expiryGuard).toContain("lamako_mobile_v2_expire_stale_orders();");
  });

  it("does not auto-cancel a payment still awaiting provider reconciliation", () => {
    expect(commerce).toContain(
      "lamako_mobile_v2_order_has_protected_payment_attempt( $order )",
    );
    expect(commerce).toContain(
      "lamako_mobile_v2_mark_payment_for_review( $order",
    );
  });

  it("deduplicates repeated native checkout creation requests", () => {
    expect(commerce).toContain(
      "function lamako_mobile_v2_checkout_idempotency_key",
    );
    expect(commerce).toContain("SELECT GET_LOCK(%s, %d)");
    expect(commerce).toContain("lamako_v2_checkout_in_progress");
    expect(commerce).toContain(
      "set_transient(\n            $idempotency_cache_key",
    );
  });

  it("voids tickets and releases seats when a mobile order closes unsuccessfully", () => {
    expect(commerce).toContain(
      "add_action( 'woocommerce_order_status_changed', 'lamako_mobile_v2_enforce_closed_order_lifecycle'",
    );
    expect(commerce).toContain(
      "function lamako_mobile_v2_void_closed_order_ticket_instances",
    );
    expect(commerce).toContain(
      "function lamako_mobile_v2_order_ticket_instance_ids",
    );
    expect(commerce).toContain("'key'     => 'item_id'");
    expect(commerce).toContain("'meta_key'       => 'tc_wc_order_id'");
    expect(commerce).toContain("'post_parent__in' =>");
    expect(commerce).toContain(
      "in_array( $to_status, [ 'cancelled', 'failed', 'refunded' ], true )",
    );
    expect(commerce).toContain(
      "lamako_mobile_v2_release_expired_order_seats( $order )",
    );
  });
});

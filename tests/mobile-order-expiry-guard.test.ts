import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const guard = fs.readFileSync(
  path.resolve(__dirname, "..", "scripts", "tbl-mobile-order-expiry-guard.php"),
  "utf8",
);

describe("mobile unpaid order expiry guard", () => {
  it("targets only unpaid Lamako Mobile orders with an expired hold", () => {
    expect(guard).toContain("'_lamako_mobile_v2'");
    expect(guard).toContain(
      "if ( ! $order instanceof WC_Order || $order->is_paid() )",
    );
    expect(guard).toContain("time() < $expires_at");
  });

  it("re-reads the order before cancellation so provider callbacks win", () => {
    expect(guard).toContain("$fresh_order = wc_get_order( $order->get_id() )");
    expect(guard).toContain("$fresh_order->is_paid()");
    expect(guard).toContain("$fresh_order->update_status( 'cancelled'");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const plugin = fs
  .readFileSync(
    path.join(root, "scripts/lamako-mobile-api/lamako-mobile-api.php"),
    "utf8",
  )
  .replace(/\r\n/g, "\n");

function section(start: string, end: string): string {
  const startIndex = plugin.indexOf(start);
  const endIndex = plugin.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return plugin.slice(startIndex, endIndex);
}

describe("legacy mobile commerce security", () => {
  it("does not globally override WooCommerce purchasability or stock", () => {
    expect(plugin).not.toContain("lamako_force_all_purchasable");
    expect(plugin).not.toContain("lamako_force_all_in_stock");
    expect(plugin).not.toContain(
      "add_filter( 'woocommerce_is_purchasable', '__return_true'",
    );
    expect(plugin).not.toContain(
      "add_filter( 'woocommerce_product_is_in_stock', '__return_true'",
    );
    expect(plugin).toContain("$lamako_checkout_product_ids");
    expect(plugin).toContain(
      "array_intersect( $candidate_ids, $lamako_checkout_product_ids )",
    );
  });

  it("validates product ownership, publication and stock before creating an order", () => {
    const createOrder = section(
      "function lamako_mobile_create_order( $request )",
      "// ============================================================\n// 6. PUSH NOTIFICATIONS",
    );

    expect(createOrder).toContain("$base_product_id !== $product_id");
    expect(createOrder).toContain(
      "get_post_status( $base_product_id ) !== 'publish'",
    );
    expect(createOrder).toContain("! $product->is_in_stock()");
    expect(createOrder).toContain("! $product->has_enough_stock( $quantity )");
    expect(createOrder).not.toContain("$force_purchasable");
    expect(createOrder).not.toContain("$force_in_stock");
  });

  it("clears only session-owned cart state without mutating arbitrary orders", () => {
    const clearCart = section(
      "function lamako_mobile_clear_cart( $request )",
      "/**\n * Authenticate using WooCommerce consumer key/secret",
    );

    expect(clearCart).toContain("TC_Seat_Chart::set_seats_cookie( [] )");
    expect(clearCart).toContain("WC()->cart->empty_cart( true )");
    expect(clearCart).toContain("delete_transient( 'tc_cart_' . $cookie_id )");
    expect(clearCart).not.toContain("get_param( 'order_id' )");
    expect(clearCart).not.toContain("get_param( 'chart_id' )");
    expect(clearCart).not.toContain("update_status(");
    expect(clearCart).not.toContain("$wpdb->query(");
    expect(clearCart).not.toContain("_transient_tc_seat_%");
    expect(clearCart).not.toContain("tc_remove_expired_firebase_seats_action");
  });

  it("never falls back to ticket instances outside the requested order", () => {
    const orderTickets = section(
      "function lamako_mobile_get_order_tickets( $request )",
      "// ============================================================\n// 5. CREATE ORDER ENDPOINT",
    );

    expect(orderTickets).toContain(
      "[ 'key' => 'item_id', 'value' => $item_id ]",
    );
    expect(orderTickets).toContain(
      "[ 'key' => 'tc_wc_order_id', 'value' => $order_id ]",
    );
    expect(orderTickets).not.toContain(
      "Fallback by ticket_type_id (broader search)",
    );
    expect(orderTickets).not.toContain("'orderby'        => 'ID'");
  });
});

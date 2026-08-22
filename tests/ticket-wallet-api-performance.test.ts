import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "scripts",
    "lamako-mobile-api",
    "includes",
    "v2-commerce.php",
  ),
  "utf8",
);

describe("ticket wallet API performance", () => {
  it("loads modern Tickera instances in one grouped query", () => {
    expect(source).toContain(
      "function lamako_mobile_v2_get_tickets_for_orders",
    );
    expect(source).toContain("'compare' => 'IN'");
    expect(source).toContain("array_keys( $item_contexts )");
    expect(source).toContain("update_meta_cache( 'post', $instance_ids )");
    expect(source).toContain("$tickets_by_item[ $item_id ]");
    expect(source).toContain("$tickets_by_order[ $order_id ] = array_merge(");
  });

  it("passes preloaded tickets into order summaries", () => {
    expect(source).toContain(
      "$ticket_map = $include_tickets ? lamako_mobile_v2_get_tickets_for_orders( $orders ) : [];",
    );
    expect(source).toContain("$preloaded_tickets");
    expect(source).toContain("is_array( $preloaded_tickets )");
  });

  it("preserves the legacy tc_orders fallback", () => {
    expect(source).toContain("'post_type'      => 'tc_orders'");
    expect(source).toContain(
      "lamako_mobile_v2_get_tickets_for_order( $order )",
    );
  });

  it("includes the event poster in each ticket context without another mobile request", () => {
    expect(source).toContain(
      "get_the_post_thumbnail_url( $event_id, 'medium_large' )",
    );
    expect(source).toContain("'eventImage'");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve("scripts/lamako-mobile-api/includes/v2-commerce.php"),
  "utf8",
);

describe("mobile API catalogue query", () => {
  it("scopes ticket products to the events returned by the catalogue", () => {
    expect(source).toContain("$event_ids  = wp_list_pluck( $events, 'ID' );");
    expect(source).toContain(
      "lamako_mobile_v2_public_ticket_map( $event_ids, $include_details )",
    );
    expect(source).toContain("'compare' => 'IN'");
  });

  it("keeps single-event callers backward compatible", () => {
    expect(source).toContain("if ( ! is_array( $event_ids ) )");
    expect(source).toContain(
      "lamako_mobile_v2_public_ticket_map( $event_id, true )",
    );
    expect(source).toContain(
      "lamako_mobile_v2_public_ticket_map( $event_id, false )",
    );
  });

  it("caches public catalogues briefly and invalidates them after content changes", () => {
    expect(source).toContain("LAMAKO_MOBILE_V2_CATALOG_TTL");
    expect(source).toContain("lamako_mobile_v2_catalog_cached_response");
    expect(source).toContain("lamako_mobile_v2_catalog_fresh_response");
    expect(source).toContain("save_post_tc_events");
    expect(source).toContain("save_post_product");
    expect(source).toContain("created_event_category");
    expect(source).toContain("created_product_cat");
    expect(source).toContain("X-Lamako-Catalog-Cache");
  });

  it("serves card-sized images in lists while preserving large detail images", () => {
    expect(source).toContain("$include_details ? 'large' : 'medium_large'");
    expect(source).toContain(
      "lamako_mobile_v2_public_product_images( $product, $include_details ? 'large' : 'medium_large' )",
    );
  });
});

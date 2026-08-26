import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const generator = fs.readFileSync(
  path.resolve(__dirname, "..", "scripts", "tbl-public-catalog-snapshots.php"),
  "utf8",
);
const transport = fs.readFileSync(
  path.resolve(__dirname, "..", "scripts", "lamako-catalog", "index.php"),
  "utf8",
);
const client = fs.readFileSync(
  path.resolve(__dirname, "..", "lib", "api", "catalog.ts"),
  "utf8",
);

describe("public catalogue snapshots", () => {
  it("generates only fixed anonymous catalogue scopes", () => {
    expect(generator).toContain("/lamako-mobile/v2/public/home-data");
    expect(generator).toContain("/lamako-mobile/v2/public/events-data");
    expect(generator).toContain("/lamako-mobile/v2/public/shop-data");
    expect(generator).not.toContain("/payments/");
    expect(generator).not.toContain("/checkouts/");
    expect(generator).not.toContain("/orders/");
  });

  it("publishes snapshots atomically and refreshes after catalogue invalidation", () => {
    expect(generator).toContain("file_put_contents( $temp, $json, LOCK_EX )");
    expect(generator).toContain("rename( $temp, $target )");
    expect(generator).toContain("lamako_mobile_v2_catalog_cache_version");
    expect(generator).toContain("added_option");
    expect(generator).toContain("wp_schedule_single_event");
    expect(generator).toContain(".invalidated");
    expect(generator).toContain("sanitize_key( $scope ) . '.version'");
  });

  it("serves a strict scope allowlist without bootstrapping WordPress", () => {
    expect(transport).toContain("[ 'home', 'events', 'shop' ]");
    expect(transport).toContain("X-Content-Type-Options: nosniff");
    expect(transport).toContain("ETag:");
    expect(transport).toContain("catalog_snapshot_stale");
    expect(transport).toContain("$invalidated > $version");
    expect(transport).toContain("LOCK_EX | LOCK_NB");
    expect(transport).toContain("fastcgi_finish_request");
    expect(transport).toContain("tbl_catalog_atomic_write");
    expect(transport).toContain("$missing || $invalidated > $version");
    expect(transport).toContain("staging.ticketbylamako.com");
    expect(transport).not.toContain("wp-load.php");
    expect(transport).not.toContain("ABSPATH");
  });

  it("uses a bounded snapshot request with the existing REST API as fallback", () => {
    expect(client).toContain("/lamako-catalog/index.php");
    expect(client).toContain("setTimeout(() => controller.abort(), 2500)");
    expect(client).toContain('url.searchParams.set("cacheBucket"');
    expect(client).toContain("Math.floor(Date.now() / 60_000)");
    expect(client).toContain("fetchCatalogWithFallback<any>");
    expect(client).toContain('mobileV2Fetch<any>("public/home-data"');
    expect(client).toContain('mobileV2Fetch<any>("public/events-data"');
    expect(client).toContain('mobileV2Fetch<any>("public/shop-data"');
  });
});

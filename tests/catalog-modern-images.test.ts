import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(...segments: string[]) {
  return fs.readFileSync(path.join(root, ...segments), "utf8");
}

describe("catalogue modern image variants", () => {
  it("generates isolated WebP and AVIF derivatives without replacing originals", () => {
    const source = read(
      "scripts",
      "lamako-mobile-api",
      "includes",
      "v2-catalog-images.php",
    );
    expect(source).toContain("lamako-catalog-variants");
    expect(source).toContain("image/webp");
    expect(source).toContain("image/avif");
    expect(source).toContain("wp_get_image_editor");
    expect(source).toContain("wp_update_attachment_metadata");
    expect(source).toContain("get_attached_file");
  });

  it("keeps original URLs in the API and adds optional variant metadata", () => {
    const commerce = read(
      "scripts",
      "lamako-mobile-api",
      "includes",
      "v2-commerce.php",
    );
    const variants = read(
      "scripts",
      "lamako-mobile-api",
      "includes",
      "v2-catalog-images.php",
    );
    expect(commerce).toContain("'featuredImage'   => $featured ?: null");
    expect(commerce).toContain("v2-catalog-images.php");
    expect(variants).toContain("rest_request_after_callbacks");
    expect(variants).toContain("featuredImageVariants");
    expect(variants).toContain("['variants']");
  });

  it("prefers WebP in the app and falls back to the original URL on error", () => {
    const image = read("components", "catalog-image.tsx");
    const catalog = read("lib", "api", "catalog.ts");
    expect(image).toContain("optimizedUri || uri || null");
    expect(image).toContain("if (uri && activeUri !== uri)");
    expect(image).toContain("setActiveUri(uri)");
    expect(catalog).toContain("normalizeCatalogImageVariants");
  });
});

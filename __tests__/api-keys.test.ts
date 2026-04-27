import { describe, it, expect } from "vitest";

describe("API Credentials Validation", () => {
  it("should have WC consumer key set", () => {
    expect(process.env.EXPO_PUBLIC_WC_CONSUMER_KEY).toBeDefined();
    expect(process.env.EXPO_PUBLIC_WC_CONSUMER_KEY).toMatch(/^ck_/);
  });

  it("should have WC consumer secret set", () => {
    expect(process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET).toBeDefined();
    expect(process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET).toMatch(/^cs_/);
  });

  it("should have site URL set", () => {
    expect(process.env.EXPO_PUBLIC_SITE_URL).toBeDefined();
    expect(process.env.EXPO_PUBLIC_SITE_URL).toContain("ticketbylamako");
  });

  it("should successfully fetch products from WooCommerce API", async () => {
    const url = `${process.env.EXPO_PUBLIC_SITE_URL}/wp-json/wc/v3/products?per_page=1&consumer_key=${process.env.EXPO_PUBLIC_WC_CONSUMER_KEY}&consumer_secret=${process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

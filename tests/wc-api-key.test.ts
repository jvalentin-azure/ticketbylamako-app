import { describe, it, expect } from "vitest";

describe("WooCommerce API Key Validation", () => {
  it("should authenticate with WooCommerce REST API", async () => {
    const siteUrl = process.env.EXPO_PUBLIC_SITE_URL;
    const consumerKey = process.env.EXPO_PUBLIC_WC_CONSUMER_KEY;
    const consumerSecret = process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET;

    expect(siteUrl).toBeDefined();
    expect(consumerKey).toBeDefined();
    expect(consumerSecret).toBeDefined();
    expect(consumerKey).toMatch(/^ck_/);
    expect(consumerSecret).toMatch(/^cs_/);

    // Test the API key by fetching a lightweight endpoint
    const url = `${siteUrl}/wp-json/wc/v3/products?per_page=1&consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TicketByLamako-App/1.0",
        "Accept": "application/json",
      },
    });

    // Should get 200 (success) not 401 (unauthorized)
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

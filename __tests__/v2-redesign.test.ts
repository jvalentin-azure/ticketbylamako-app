import { describe, it, expect } from "vitest";
import { formatAriary, formatDateShort, decodeHtmlEntities, stripHtml } from "../lib/format";

describe("V2 Redesign - Format Utilities", () => {
  it("formatAriary formats numbers correctly", () => {
    expect(formatAriary(50000)).toContain("50");
    expect(formatAriary(50000)).toContain("Ar");
    expect(formatAriary("25000")).toContain("25");
    expect(formatAriary(0)).toBe("0 Ar");
    expect(formatAriary("invalid")).toBe("0 Ar");
  });

  it("formatDateShort returns a short French date", () => {
    const result = formatDateShort("2026-04-27T10:00:00");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("decodeHtmlEntities decodes common entities", () => {
    expect(decodeHtmlEntities("Hello &amp; World")).toBe("Hello & World");
    expect(decodeHtmlEntities("Test &#8211; Dash")).toBe("Test – Dash");
    expect(decodeHtmlEntities("&lt;b&gt;Bold&lt;/b&gt;")).toBe("<b>Bold</b>");
    expect(decodeHtmlEntities("&quot;Quoted&quot;")).toBe('"Quoted"');
    expect(decodeHtmlEntities("No entities")).toBe("No entities");
    expect(decodeHtmlEntities("&#x2019;")).toBe("\u2019"); // right single quote
  });

  it("stripHtml removes HTML tags and decodes entities", () => {
    expect(stripHtml("<p>Hello &amp; World</p>")).toBe("Hello & World");
    expect(stripHtml("<b>Bold</b> text")).toBe("Bold text");
    expect(stripHtml("")).toBe("");
  });
});

describe("V2 Redesign - Theme Config", () => {
  it("theme.config.js exports valid color tokens", async () => {
    const { themeColors } = await import("../theme.config.js");
    expect(themeColors).toBeDefined();
    expect(themeColors.primary).toBeDefined();
    expect(themeColors.primary.light).toBe("#663d17");
    expect(themeColors.primary.dark).toBe("#c79f6c");
    expect(themeColors.background).toBeDefined();
    expect(themeColors.foreground).toBeDefined();
    expect(themeColors.surface).toBeDefined();
    expect(themeColors.muted).toBeDefined();
    expect(themeColors.border).toBeDefined();
    expect(themeColors.accent).toBeDefined();
    expect(themeColors.accent.light).toBe("#c79f6c");
  });
});

describe("V2 Redesign - WooCommerce API types", () => {
  it("woocommerce module exports required types and functions", async () => {
    const wc = await import("../lib/api/woocommerce");
    expect(typeof wc.getEventsWithTickets).toBe("function");
    expect(typeof wc.getShopProducts).toBe("function");
    expect(typeof wc.getShopCategories).toBe("function");
    expect(typeof wc.getProducts).toBe("function");
    expect(typeof wc.getProduct).toBe("function");
    expect(typeof wc.getCustomerOrders).toBe("function");
    expect(typeof wc.getAllOrders).toBe("function");
  });
});

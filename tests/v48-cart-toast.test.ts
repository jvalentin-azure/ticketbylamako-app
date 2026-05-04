import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("V4.8 - Cart Toast & Plugin Redeploy", () => {
  describe("CartToast component", () => {
    const toastPath = path.resolve(__dirname, "../components/cart-toast.tsx");
    const toastContent = fs.readFileSync(toastPath, "utf-8");

    it("should export CartToast component", () => {
      expect(toastContent).toContain("export function CartToast");
    });

    it("should accept visible, message, itemName, and onHide props", () => {
      expect(toastContent).toContain("visible: boolean");
      expect(toastContent).toContain("message?: string");
      expect(toastContent).toContain("itemName?: string");
      expect(toastContent).toContain("onHide?: () => void");
    });

    it("should trigger haptic feedback when visible", () => {
      expect(toastContent).toContain("Haptics.notificationAsync");
      expect(toastContent).toContain("NotificationFeedbackType.Success");
    });

    it("should auto-hide after timeout", () => {
      expect(toastContent).toContain("setTimeout");
      expect(toastContent).toContain("1500");
    });

    it("should use Animated for slide-in animation", () => {
      expect(toastContent).toContain("Animated.View");
      expect(toastContent).toContain("Animated.spring");
      expect(toastContent).toContain("Animated.timing");
    });

    it("should display checkmark and cart icon", () => {
      expect(toastContent).toContain("checkCircle");
      expect(toastContent).toContain("✓");
      expect(toastContent).toContain("🛒");
    });

    it("should show default French message", () => {
      expect(toastContent).toContain("Ajouté au panier");
    });
  });

  describe("Event detail add-to-cart integration", () => {
    const eventPath = path.resolve(__dirname, "../app/event/[id].tsx");
    const eventContent = fs.readFileSync(eventPath, "utf-8");

    it("should import CartToast", () => {
      expect(eventContent).toContain('import { CartToast } from "@/components/cart-toast"');
    });

    it("should have showCartToast state", () => {
      expect(eventContent).toContain("showCartToast");
      expect(eventContent).toContain("setShowCartToast");
    });

    it("should show toast before navigating to cart", () => {
      expect(eventContent).toContain("setShowCartToast(true)");
      expect(eventContent).toContain("setTimeout");
      // Ensure navigation happens after delay
      const addToCartSection = eventContent.substring(
        eventContent.indexOf("const handleAddToCart"),
        eventContent.indexOf("const handleAddToCart") + 500
      );
      expect(addToCartSection).toContain("setShowCartToast(true)");
      expect(addToCartSection).toContain("setTimeout");
      expect(addToCartSection).toContain('router.push("/(tabs)/cart"');
    });

    it("should render CartToast component in JSX", () => {
      expect(eventContent).toContain("<CartToast");
      expect(eventContent).toContain("visible={showCartToast}");
      expect(eventContent).toContain("itemName={cartToastName}");
    });
  });

  describe("Product detail add-to-cart integration", () => {
    const productPath = path.resolve(__dirname, "../app/product/[id].tsx");
    const productContent = fs.readFileSync(productPath, "utf-8");

    it("should import CartToast", () => {
      expect(productContent).toContain('import { CartToast } from "@/components/cart-toast"');
    });

    it("should have showCartToast state", () => {
      expect(productContent).toContain("showCartToast");
      expect(productContent).toContain("setShowCartToast");
    });

    it("should show toast before navigating to cart", () => {
      expect(productContent).toContain("setShowCartToast(true)");
      expect(productContent).toContain("setTimeout");
      expect(productContent).toContain('router.push("/(tabs)/cart"');
    });

    it("should render CartToast component in JSX", () => {
      expect(productContent).toContain("<CartToast");
      expect(productContent).toContain("visible={showCartToast}");
    });
  });

  describe("Plugin fixes (esc_url -> esc_js)", () => {
    const pluginPath = path.resolve(__dirname, "../scripts/lamako-mobile-api.php");
    const pluginContent = fs.readFileSync(pluginPath, "utf-8");

    it("should use esc_js for redirect URL in auto-login", () => {
      expect(pluginContent).toContain("esc_js( $redirect )");
    });

    it("should NOT use esc_url for JavaScript redirect in auto-login", () => {
      // The auto-login redirect uses esc_js, not esc_url
      const escJsIdx = pluginContent.indexOf("esc_js( $redirect )");
      expect(escJsIdx).toBeGreaterThan(-1);
      // Get surrounding context to verify it's in a window.location.href context
      const context = pluginContent.substring(Math.max(0, escJsIdx - 80), escJsIdx + 50);
      expect(context).toContain("window.location.href");
      expect(context).not.toContain("esc_url");
    });

    it("should have checkout CSS to hide theme content", () => {
      expect(pluginContent).toContain("rev_slider");
      expect(pluginContent).toContain("fkcart");
      expect(pluginContent).toContain("gt-mobile-header");
    });

    it("should have post-wp_footer cleanup script in checkout", () => {
      expect(pluginContent).toContain("Post-wp_footer cleanup");
      expect(pluginContent).toContain("validClasses");
      expect(pluginContent).toContain("lamako-checkout-header");
    });
  });
});

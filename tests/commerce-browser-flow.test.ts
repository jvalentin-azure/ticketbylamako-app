import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("native commerce payment flow", () => {
  it("routes normal and seating orders to the same native payment screen", () => {
    expect(source("app/checkout.tsx")).toContain('pathname: "/payment"');
    expect(source("components/seating/SeatPurchaseFlow.tsx")).toContain(
      'case "SEATING_ORDER_CREATED"',
    );
    expect(source("components/seating/SeatPurchaseFlow.tsx")).toContain(
      'pathname: "/payment"',
    );
  });

  it("loads payment methods and starts payment through the authenticated API", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    expect(paymentSource).toContain("getMobilePaymentMethods(token, kind)");
    expect(paymentSource).toContain("startMobilePayment(token, kind");
    expect(paymentSource).toContain(
      "getMobilePaymentReturnStatus(kind, token)",
    );
  });

  it("keeps the embedded WebView limited to the first-party seating chart", () => {
    const seatingSource = source("components/seating/SeatPurchaseFlow.tsx");
    expect(seatingSource).toContain('isAllowedWebViewUrl(url, "first-party")');
    expect(seatingSource).not.toContain("openCommerceSession");
  });

  it("opens a secure in-app browser sheet only for redirect gateways", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    const browserSource = source("lib/commerce-browser.ts");
    const screenSource = source("app/payment.tsx");
    expect(paymentSource).toContain('response.flow === "redirect"');
    expect(paymentSource).toContain(
      "openCommerceSession(response.redirectUrl)",
    );
    expect(paymentSource).not.toContain("openAuthSessionAsync");
    expect(browserSource).toContain("openBrowserAsync");
    expect(browserSource).toContain('isAllowedWebViewUrl(url, "payment")');
    expect(browserSource).not.toContain("openAuthSessionAsync");
    expect(screenSource).toContain("Annuler la commande");
    expect(screenSource).not.toContain("Actualiser le statut");
  });

  it("keeps the reservation status visible while provider verification is active", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    const screenSource = source("app/payment.tsx");
    const partsSource = source("components/payment/PaymentScreenParts.tsx");
    expect(paymentSource).not.toContain(
      "reservationExpired || paymentInProgress",
    );
    expect(screenSource).toContain("paymentInProgress={paymentInProgress}");
    expect(partsSource).toContain("Paiement en cours, réservation protégée");
  });

  it("treats cancellation as terminal instead of reopening payment", () => {
    const returnSource = source("app/payment-return.tsx");
    const returnHookSource = source("hooks/use-payment-return.ts");
    expect(returnSource).toContain(
      'phase === "cancelled" || phase === "failed"',
    );
    expect(returnSource).toContain('"Réessayer"');
    expect(returnSource).toContain('exitTo("/(tabs)/cart"');
    expect(returnSource).toContain("const returnHome = () =>");
    expect(returnSource).toContain("clearCart();");
    expect(returnHookSource).toContain("clearCart()");
    expect(returnHookSource).toContain('phase: "cancelled"');
    expect(returnHookSource).toContain("clearCart: false");
    expect(returnHookSource).toContain("cancelMobilePayment(kind, token)");
    expect(returnSource).not.toContain('pathname: "/payment"');
    expect(returnSource).toContain("RÉFÉRENCE DE COMMANDE");
    expect(returnSource).toContain("Voir mes billets");
    expect(returnSource).toContain("<Confetti");
  });

  it("renders provider logos supplied by the secured payment API", () => {
    expect(source("lib/api/mobile.ts")).toContain("iconUrl?: string");
    expect(source("components/payment/PaymentScreenParts.tsx")).toContain(
      "method.iconUrl",
    );
  });

  it("keeps a direct path back to event discovery from the cart", () => {
    const cartSource = source("app/(tabs)/cart.tsx");
    expect(cartSource).toContain("Continuer vos achats");
    expect(cartSource).toContain('router.push("/(tabs)/events"');
  });

  it("locks payment-method changes while a provider attempt is active", () => {
    const screenSource = source("app/payment.tsx");
    expect(screenSource).toContain("disabled={paymentInProgress}");
    expect(screenSource).toContain("afin d'éviter un double débit");
    expect(screenSource).toContain("order?.paymentMethod");
  });

  it("keeps provider verification active for pending and review states", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    expect(paymentSource).toContain(
      'phase !== "pending" && phase !== "review"',
    );
    expect(paymentSource).toContain("checkStatus(true)");
  });

  it("prevents the covered payment screen from reopening a terminal result", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    const returnHookSource = source("hooks/use-payment-return.ts");
    const returnScreenSource = source("app/payment-return.tsx");
    const navigationSource = source("lib/payment-navigation.ts");
    expect(paymentSource).toContain("useIsFocused");
    expect(paymentSource).toContain("terminalNavigationRef.current");
    expect(paymentSource).toContain("!isFocusedRef.current");
    expect(paymentSource).toContain("hasTerminalPaymentToken(token)");
    expect(returnHookSource).toContain("claimPaymentNotification");
    expect(returnScreenSource).toContain("claimPaymentCelebration");
    expect(returnScreenSource).toContain('normalized: "1"');
    expect(returnScreenSource).toContain("replacePaymentFlowRoot");
    expect(navigationSource).toContain("router.dismissAll()");
  });

  it("does not treat a new unpaid order as an already-started provider payment", () => {
    const paymentSource = source("hooks/use-mobile-payment.ts");
    expect(paymentSource).toContain("IN_PROGRESS_ATTEMPT_STATUSES.has");
    expect(paymentSource).toContain('order?.paymentAttemptStatus || ""');
    expect(paymentSource).not.toContain(
      'order?.paymentStatus === "pending" ||',
    );
  });
});

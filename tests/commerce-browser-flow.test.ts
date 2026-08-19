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
    const paymentSource = source("app/payment.tsx");
    expect(paymentSource).toContain("getMobilePaymentMethods(token, kind)");
    expect(paymentSource).toContain("startMobilePayment(token, kind");
    expect(paymentSource).toContain("getMobilePaymentReturnStatus(kind, token)");
  });

  it("keeps the embedded WebView limited to the first-party seating chart", () => {
    const seatingSource = source("components/seating/SeatPurchaseFlow.tsx");
    expect(seatingSource).toContain(
      'isAllowedWebViewUrl(url, "first-party")',
    );
    expect(seatingSource).not.toContain("openCommerceSession");
  });

  it("opens a system authorization session only for redirect gateways", () => {
    const paymentSource = source("app/payment.tsx");
    expect(paymentSource).toContain('response.flow === "redirect"');
    expect(paymentSource).toContain("openAuthSessionAsync");
    expect(paymentSource).toContain('browserResult.type === "cancel"');
    expect(paymentSource).toContain("cancelMobilePayment(kind, token)");
    expect(paymentSource).toContain("Annuler et réessayer");
    expect(paymentSource).not.toContain("Actualiser le statut");
  });

  it("locks payment-method changes while a provider attempt is active", () => {
    const paymentSource = source("app/payment.tsx");
    expect(paymentSource).toContain("disabled={paymentInProgress}");
    expect(paymentSource).toContain("afin d'éviter un double débit");
    expect(paymentSource).toContain("order?.paymentMethod");
  });

  it("keeps provider verification active for pending and review states", () => {
    const paymentSource = source("app/payment.tsx");
    expect(paymentSource).toContain(
      'phase !== "pending" && phase !== "review"',
    );
    expect(paymentSource).toContain("checkStatus(true)");
  });

  it("does not treat a new unpaid order as an already-started provider payment", () => {
    const paymentSource = source("app/payment.tsx");
    expect(paymentSource).toContain(
      'const paymentAttemptStatus = order?.paymentAttemptStatus || ""',
    );
    expect(paymentSource).not.toContain(
      'order?.paymentStatus === "pending" ||',
    );
  });
});

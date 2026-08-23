import { describe, expect, it } from "vitest";

import {
  getPaymentMethodPresentation,
  paymentMethodRequiresPhone,
} from "../lib/payment-method-presentation";
import type { MobilePaymentMethod } from "../lib/api/mobile";

function method(id: string, title: string): MobilePaymentMethod {
  return {
    id,
    title,
    description: "",
    flow: id === "cybersource" ? "redirect" : "async",
    requiresPhone: false,
  };
}

describe("payment method presentation", () => {
  it.each([
    ["mvola", "MVola", "#078B52"],
    ["airtel", "Airtel Money", "#D71920"],
    ["papi_paiement", "Orange Money", "#F16E00"],
  ])("requires a phone for %s", (id, title, accent) => {
    const paymentMethod = method(id, title);
    expect(paymentMethodRequiresPhone(paymentMethod)).toBe(true);
    expect(getPaymentMethodPresentation(paymentMethod).accent).toBe(accent);
  });

  it.each([
    ["cybersource", "Paiement par carte bancaire"],
    ["bank_transfer", "Virement bancaire"],
  ])("does not request a phone for %s", (id, title) => {
    expect(paymentMethodRequiresPhone(method(id, title))).toBe(false);
  });

  it("does not request a phone before a payment method is selected", () => {
    expect(paymentMethodRequiresPhone(null)).toBe(false);
  });
});

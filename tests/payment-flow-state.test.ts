import { describe, expect, it } from "vitest";

import {
  claimPaymentCelebration,
  claimPaymentNotification,
  claimTerminalPaymentToken,
  hasTerminalPaymentToken,
} from "../lib/payment-flow-state";

describe("payment flow state", () => {
  it("allows only one terminal navigation per payment token", () => {
    const token = `terminal-${Date.now()}`;
    expect(claimTerminalPaymentToken(token)).toBe(true);
    expect(hasTerminalPaymentToken(token)).toBe(true);
    expect(claimTerminalPaymentToken(token)).toBe(false);
  });

  it("allows only one notification and celebration per order", () => {
    const orderId = Math.floor(Date.now() / 10);
    expect(claimPaymentNotification(orderId)).toBe(true);
    expect(claimPaymentNotification(orderId)).toBe(false);
    expect(claimPaymentCelebration(orderId)).toBe(true);
    expect(claimPaymentCelebration(orderId)).toBe(false);
  });
});

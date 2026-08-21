import { describe, expect, it } from "vitest";
import { parseStoredBillingInfo } from "@/lib/billing-info";

describe("billing store", () => {
  it("normalizes valid billing data", () => {
    expect(
      parseStoredBillingInfo(
        JSON.stringify({
          phone: " 034 00 000 00 ",
          address: " Lot 1 ",
          city: " Antananarivo ",
        }),
      ),
    ).toEqual({
      phone: "034 00 000 00",
      address: "Lot 1",
      city: "Antananarivo",
    });
  });

  it("rejects corrupted and structurally invalid values", () => {
    expect(parseStoredBillingInfo("not-json")).toBeNull();
    expect(parseStoredBillingInfo(JSON.stringify(["034"]))).toBeNull();
    expect(parseStoredBillingInfo(JSON.stringify({ phone: 34 }))).toBeNull();
  });

  it("keeps a partially completed billing profile", () => {
    expect(
      parseStoredBillingInfo(JSON.stringify({ phone: "0340000000" })),
    ).toEqual({ phone: "0340000000", address: "", city: "" });
  });
});

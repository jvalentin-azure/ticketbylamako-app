import { describe, expect, it } from "vitest";
import {
  buildCheckoutItemInputs,
  buildDefaultCheckoutFieldValues,
  cartNeedsCheckoutFieldSchema,
  validateCheckoutFieldValues,
} from "@/lib/checkout-fields";
import type { MobileCheckoutFieldsResponse } from "@/lib/api/mobile";
import type { CheckoutFieldSchema } from "@/lib/types/commerce";

function field(
  key: string,
  scope: "buyer" | "attendee",
  required = true,
): CheckoutFieldSchema {
  return {
    key,
    storageKey: `stored_${key}`,
    label: key,
    type: key.includes("email") ? "email" : "text",
    scope,
    required,
    visible: true,
    custom: false,
    options: [],
  };
}

const schema: MobileCheckoutFieldsResponse = {
  buyerFields: [field("first_name", "buyer"), field("email", "buyer")],
  items: [
    {
      productId: 12,
      eventId: 34,
      name: "Billet QA",
      quantity: 2,
      requiresFields: true,
      hasFields: true,
      ownerFields: [
        field("first_name", "attendee"),
        field("owner_email", "attendee"),
      ],
    },
  ],
  hasFields: true,
  requiresFields: true,
};

describe("checkout field helpers", () => {
  it("always asks the server for ticket fields even when catalog hints are stale", () => {
    expect(
      cartNeedsCheckoutFieldSchema([
        {
          productId: 12,
          eventId: 34,
          name: "Billet QA",
          price: 300,
          quantity: 1,
          image: "",
          isEvent: true,
          hasCheckoutFields: false,
          requiresCheckoutFields: false,
        },
      ]),
    ).toBe(true);
  });

  it("pre-fills buyer and attendee identity from the authenticated user", () => {
    const values = buildDefaultCheckoutFieldValues(schema, {
      firstName: "Miora",
      lastName: "Rakoto",
      email: "miora@example.com",
    });

    expect(values.buyerValues.stored_first_name).toBe("Miora");
    expect(values.buyerValues.stored_email).toBe("miora@example.com");
    expect(values.ticketValues[12][0].stored_first_name).toBe("Miora");
    expect(values.ticketValues[12][1].stored_owner_email).toBe(
      "miora@example.com",
    );
  });

  it("validates required fields and email syntax", () => {
    const errors = validateCheckoutFieldValues(
      schema,
      { stored_first_name: "", stored_email: "invalid" },
      {
        12: {
          0: { stored_first_name: "Miora", stored_owner_email: "invalid" },
          1: { stored_first_name: "", stored_owner_email: "miora@example.com" },
        },
      },
    );

    expect(errors["buyer:stored_first_name"]).toBe("Champ requis");
    expect(errors["buyer:stored_email"]).toBe("Email invalide");
    expect(errors["12:0:stored_owner_email"]).toBe("Email invalide");
    expect(errors["12:1:stored_first_name"]).toBe("Champ requis");
  });

  it("only attaches attendee fields when creating the final order", () => {
    const items = [
      {
        productId: 12,
        eventId: 34,
        name: "Billet QA",
        price: 300,
        quantity: 2,
        image: "",
        isEvent: true,
      },
    ];
    const attendeeValues = {
      12: {
        0: { stored_first_name: "Miora" },
        1: { stored_first_name: "Tiana" },
      },
    };

    expect(
      buildCheckoutItemInputs(items, attendeeValues, false)[0],
    ).not.toHaveProperty("attendees");
    expect(
      buildCheckoutItemInputs(items, attendeeValues, true)[0].attendees,
    ).toHaveLength(2);
  });
});

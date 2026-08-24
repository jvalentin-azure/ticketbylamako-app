import type { CartItem } from "@/lib/cart-provider";
import type {
  CheckoutFieldValue,
  MobileCheckoutFieldsResponse,
  MobileCheckoutItemInput,
} from "@/lib/api/mobile";
import type { CheckoutFieldSchema } from "@/lib/types/commerce";
import type {
  BuyerFieldValues,
  TicketFieldValues,
} from "@/components/commerce/TicketCustomFieldsForm";

export interface CheckoutUserDefaults {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export function cartNeedsCheckoutFieldSchema(items: CartItem[]): boolean {
  // Ticket metadata in the catalog is only a hint and can be stale. The server
  // remains the source of truth for Tickera/WooCommerce attendee fields.
  return items.some((item) => item.isEvent);
}

export function checkoutFieldKey(field: CheckoutFieldSchema): string {
  return field.storageKey || field.key;
}

export function isCheckoutFieldValueEmpty(
  value: CheckoutFieldValue | undefined,
): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return !value || !String(value).trim();
}

export function buildCheckoutItemInputs(
  items: CartItem[],
  ticketFieldValues: TicketFieldValues = {},
  includeFields = false,
): MobileCheckoutItemInput[] {
  return items.map((item) => {
    const payload: MobileCheckoutItemInput = {
      productId: item.productId,
      eventId: item.eventId,
      quantity: item.quantity,
      lane: item.isEvent ? "ticket" : "product",
    };

    if (includeFields && item.isEvent) {
      payload.attendees = Array.from({ length: item.quantity }).map(
        (_, index) => ({
          fields: ticketFieldValues[item.productId]?.[index] || {},
        }),
      );
    }

    return payload;
  });
}

export function buildDefaultCheckoutFieldValues(
  schema: MobileCheckoutFieldsResponse,
  user: CheckoutUserDefaults | null,
): {
  buyerValues: BuyerFieldValues;
  ticketValues: TicketFieldValues;
} {
  const buyerValues: BuyerFieldValues = {};
  const ticketValues: TicketFieldValues = {};

  schema.buyerFields.forEach((field) => {
    const key = checkoutFieldKey(field);
    const fallback = field.defaultValue || "";
    if (field.key === "first_name")
      buyerValues[key] = user?.firstName || fallback;
    else if (field.key === "last_name")
      buyerValues[key] = user?.lastName || fallback;
    else if (field.key === "email" || field.key === "confirm_email") {
      buyerValues[key] = user?.email || fallback;
    } else if (fallback) buyerValues[key] = fallback;
  });

  schema.items.forEach((item) => {
    if (!item.hasFields) return;
    ticketValues[item.productId] = {};
    Array.from({ length: item.quantity }).forEach((_, index) => {
      ticketValues[item.productId][index] = {};
      item.ownerFields.forEach((field) => {
        const key = checkoutFieldKey(field);
        const fallback = field.defaultValue || "";
        if (field.key === "first_name") {
          ticketValues[item.productId][index][key] =
            user?.firstName || fallback;
        } else if (field.key === "last_name") {
          ticketValues[item.productId][index][key] = user?.lastName || fallback;
        } else if (
          field.key === "owner_email" ||
          field.key === "owner_confirm_email"
        ) {
          ticketValues[item.productId][index][key] = user?.email || fallback;
        } else if (fallback) {
          ticketValues[item.productId][index][key] = fallback;
        }
      });
    });
  });

  return { buyerValues, ticketValues };
}

export function validateCheckoutFieldValues(
  schema: MobileCheckoutFieldsResponse | null,
  buyerValues: BuyerFieldValues,
  ticketValues: TicketFieldValues,
): Record<string, string> {
  if (!schema?.hasFields) return {};
  const errors: Record<string, string> = {};

  schema.buyerFields.forEach((field) => {
    const key = checkoutFieldKey(field);
    const value = buyerValues[key];
    if (field.required && isCheckoutFieldValueEmpty(value)) {
      errors[`buyer:${key}`] = "Champ requis";
    } else if (
      !isCheckoutFieldValueEmpty(value) &&
      (field.type === "email" || field.validation === "email") &&
      typeof value === "string" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      errors[`buyer:${key}`] = "Email invalide";
    }
  });

  schema.items.forEach((item) => {
    if (!item.hasFields) return;
    Array.from({ length: item.quantity }).forEach((_, index) => {
      item.ownerFields.forEach((field) => {
        const key = checkoutFieldKey(field);
        const value = ticketValues[item.productId]?.[index]?.[key];
        const errorKey = `${item.productId}:${index}:${key}`;
        if (field.required && isCheckoutFieldValueEmpty(value)) {
          errors[errorKey] = "Champ requis";
        } else if (
          !isCheckoutFieldValueEmpty(value) &&
          (field.type === "email" || field.validation === "email") &&
          typeof value === "string" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
          errors[errorKey] = "Email invalide";
        }
      });
    });
  });

  return errors;
}

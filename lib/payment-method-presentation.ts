import type { MobilePaymentMethod } from "@/lib/api/mobile";

export interface PaymentMethodPresentation {
  accent: string;
  isMobileMoney: boolean;
  phoneLabel?: string;
  phonePlaceholder?: string;
}

function paymentMethodKey(method: MobilePaymentMethod): string {
  return `${method.id} ${method.title}`.toLocaleLowerCase("fr");
}

export function getPaymentMethodPresentation(
  method: MobilePaymentMethod,
): PaymentMethodPresentation {
  const key = paymentMethodKey(method);

  if (key.includes("mvola")) {
    return {
      accent: "#078B52",
      isMobileMoney: true,
      phoneLabel: "Numéro MVola",
      phonePlaceholder: "034 00 000 00",
    };
  }

  if (key.includes("airtel")) {
    return {
      accent: "#D71920",
      isMobileMoney: true,
      phoneLabel: "Numéro Airtel Money",
      phonePlaceholder: "033 00 000 00",
    };
  }

  if (key.includes("orange") || key.includes("papi_paiement")) {
    return {
      accent: "#F16E00",
      isMobileMoney: true,
      phoneLabel: "Numéro Orange Money",
      phonePlaceholder: "032 00 000 00",
    };
  }

  if (key.includes("cyber") || key.includes("carte") || key.includes("card")) {
    return { accent: "#234E70", isMobileMoney: false };
  }

  return { accent: "#7A4A1C", isMobileMoney: false };
}

export function paymentMethodRequiresPhone(
  method: MobilePaymentMethod | null | undefined,
): boolean {
  return method ? getPaymentMethodPresentation(method).isMobileMoney : false;
}

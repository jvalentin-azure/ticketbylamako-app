import { SITE_URL } from "@/lib/site-url";

const DEFAULT_PAYMENT_HOSTS = [
  "secureacceptance.cybersource.com",
  "cybersource.com",
  "mvola.mg",
  "telma.mg",
  "orange.mg",
  "orange.com",
  "orange-money.com",
  "airtel.mg",
  "airtel.africa",
  "visa.com",
  "mastercard.com",
];

function normalizeHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function configuredPaymentHosts(): string[] {
  const configured = (process.env.EXPO_PUBLIC_PAYMENT_HOSTS || "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_PAYMENT_HOSTS, ...configured]));
}

function isHostOrSubdomain(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function firstPartyHosts(): string[] {
  try {
    const configuredHost = normalizeHost(new URL(SITE_URL).hostname);
    const canonicalHost = configuredHost.replace(/^www\./, "");
    return Array.from(
      new Set([configuredHost, canonicalHost, `www.${canonicalHost}`]),
    );
  } catch {
    return ["ticketbylamako.com", "www.ticketbylamako.com"];
  }
}

export type WebViewPurpose = "first-party" | "payment";

export function isAllowedWebViewUrl(
  rawUrl: string,
  purpose: WebViewPurpose,
): boolean {
  if (rawUrl === "about:blank") return true;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const hostname = normalizeHost(url.hostname);
  if (firstPartyHosts().includes(hostname)) {
    return true;
  }

  if (purpose !== "payment") return false;

  return configuredPaymentHosts().some((host) =>
    isHostOrSubdomain(hostname, host),
  );
}

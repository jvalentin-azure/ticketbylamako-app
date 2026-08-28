const DEFAULT_SITE_URL = "https://www.ticketbylamako.com";

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isTicketByLamakoHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "ticketbylamako.com" ||
    normalized.endsWith(".ticketbylamako.com")
  );
}

function getTrustedBrowserOrigin(): string | null {
  try {
    if (typeof window === "undefined" || !window.location?.origin) {
      return null;
    }

    const currentOrigin = new URL(window.location.origin);
    if (
      currentOrigin.protocol !== "https:" ||
      !isTicketByLamakoHost(currentOrigin.hostname)
    ) {
      return null;
    }

    return normalizeSiteUrl(currentOrigin.origin);
  } catch {
    return null;
  }
}

const configuredSiteUrl = normalizeSiteUrl(
  process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
);

// Browser authentication depends on same-origin WordPress cookies. Resolve the
// trusted page origin at runtime so a staging export can never authenticate
// against the production domain because of a stale build-time environment.
export const SITE_URL = getTrustedBrowserOrigin() || configuredSiteUrl;


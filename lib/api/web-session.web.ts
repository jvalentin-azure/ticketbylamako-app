const NONCE_STORAGE_KEY = "ticketbylamako_wp_rest_nonce";
const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";

let memoryNonce: string | null = null;
let refreshRequest: Promise<string | null> | null = null;
let nonceEpoch = 0;

function browserSessionStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function getWebSessionNonce(): string | null {
  const stored = browserSessionStorage()?.getItem(NONCE_STORAGE_KEY) ?? null;
  return stored || memoryNonce;
}

export function setWebSessionNonce(nonce: string | null): void {
  memoryNonce = nonce;
  const storage = browserSessionStorage();
  if (!storage) return;
  if (nonce) storage.setItem(NONCE_STORAGE_KEY, nonce);
  else storage.removeItem(NONCE_STORAGE_KEY);
}

export function clearWebSessionNonce(): void {
  nonceEpoch += 1;
  setWebSessionNonce(null);
}

export async function refreshWebSessionNonce(): Promise<string | null> {
  if (refreshRequest) return refreshRequest;

  clearWebSessionNonce();
  const refreshEpoch = nonceEpoch;
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), 8_000)
    : null;
  refreshRequest = fetch(
    `${SITE_URL}/wp-json/lamako-mobile/v2/web-session`,
    {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
      signal: controller?.signal,
    },
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json().catch(() => null)) as {
        authenticated?: boolean;
        nonce?: string;
      } | null;
      if (
        refreshEpoch === nonceEpoch &&
        data?.authenticated &&
        data.nonce
      ) {
        setWebSessionNonce(data.nonce);
        return data.nonce;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      if (timeout) clearTimeout(timeout);
      refreshRequest = null;
    });

  return refreshRequest;
}

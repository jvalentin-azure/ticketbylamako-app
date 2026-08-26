const NONCE_STORAGE_KEY = "ticketbylamako_wp_rest_nonce";

let memoryNonce: string | null = null;

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
  setWebSessionNonce(null);
}

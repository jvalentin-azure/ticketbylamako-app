/**
 * Native no-op implementation. Metro replaces this module with
 * web-session.web.ts in browser bundles.
 */
export function getWebSessionNonce(): string | null {
  return null;
}

export function setWebSessionNonce(_nonce: string | null): void {}

export function clearWebSessionNonce(): void {}

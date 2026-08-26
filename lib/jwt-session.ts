import { decodeJwt } from "jose";

const CLOCK_SKEW_MS = 30_000;

const EXPLICIT_JWT_REJECTION_CODES = new Set([
  "jwt_auth_invalid_token",
  "jwt_auth_bad_iss",
  "jwt_auth_bad_request",
  "jwt_auth_unsupported_algorithm",
]);

export function isJwtLocallyUsable(
  token: string,
  nowMs = Date.now(),
): boolean {
  try {
    const payload = decodeJwt(token);
    return (
      typeof payload.exp === "number" &&
      payload.exp * 1000 > nowMs + CLOCK_SKEW_MS
    );
  } catch {
    return false;
  }
}

export function isExplicitJwtServerRejection(
  status: number,
  code: unknown,
): boolean {
  if (status !== 401 && status !== 403) return false;
  return (
    typeof code === "string" && EXPLICIT_JWT_REJECTION_CODES.has(code)
  );
}

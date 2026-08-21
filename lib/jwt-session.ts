import { decodeJwt } from "jose";

const CLOCK_SKEW_MS = 30_000;

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

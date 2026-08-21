import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { isJwtLocallyUsable } from "../lib/jwt-session";

const secret = new TextEncoder().encode("test-only-secret");

describe("offline JWT session validation", () => {
  it("accepts an unexpired signed JWT payload for offline startup", async () => {
    const now = 1_723_000_000_000;
    const token = await new SignJWT({ sub: "42" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(now / 1000) + 3600)
      .sign(secret);

    expect(isJwtLocallyUsable(token, now)).toBe(true);
  });

  it("rejects expired and malformed tokens", async () => {
    const now = 1_723_000_000_000;
    const expired = await new SignJWT({ sub: "42" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(now / 1000) - 1)
      .sign(secret);

    expect(isJwtLocallyUsable(expired, now)).toBe(false);
    expect(isJwtLocallyUsable("not-a-jwt", now)).toBe(false);
  });
});

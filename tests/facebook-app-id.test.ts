import { describe, it, expect } from "vitest";

describe("Facebook App ID", () => {
  it("should be configured as environment variable", () => {
    const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    expect(appId).toBeDefined();
    expect(appId).not.toBe("");
    expect(appId).toMatch(/^\d+$/); // Facebook App IDs are numeric
    expect(appId!.length).toBeGreaterThan(10); // Typically 15-16 digits
  });
});

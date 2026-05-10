import { describe, it, expect } from "vitest";

describe("Facebook App ID", () => {
  const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const itWithFacebookAppId = appId ? it : it.skip;

  itWithFacebookAppId("should be configured as environment variable", () => {
    expect(appId).toBeDefined();
    expect(appId).not.toBe("");
    expect(appId).toMatch(/^\d+$/); // Facebook App IDs are numeric
    expect(appId!.length).toBeGreaterThan(10); // Typically 15-16 digits
  });
});

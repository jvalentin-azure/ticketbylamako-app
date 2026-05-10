import { describe, it, expect } from "vitest";

describe("Expo Token", () => {
  const token = process.env.EXPO_TOKEN;
  const itWithExpoToken = token ? it : it.skip;

  itWithExpoToken("EXPO_TOKEN is set and has correct format", () => {
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
    // Expo tokens typically contain alphanumeric chars, hyphens, and underscores
    expect(token).toMatch(/^[a-zA-Z0-9_\-]+$/);
  });

  itWithExpoToken("can authenticate with Expo API", async () => {
    const response = await fetch("https://api.expo.dev/v2/auth/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // 200 means the token is valid
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("data");
  });
});

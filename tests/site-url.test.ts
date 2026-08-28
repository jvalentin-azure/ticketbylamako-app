import { afterEach, describe, expect, it, vi } from "vitest";

const originalWindow = globalThis.window;
const originalConfiguredSiteUrl = process.env.EXPO_PUBLIC_SITE_URL;

async function loadSiteUrl(origin: string | null): Promise<string> {
  vi.resetModules();

  if (origin) {
    vi.stubGlobal("window", { location: { origin } });
  } else {
    vi.stubGlobal("window", undefined);
  }

  const module = await import("@/lib/site-url");
  return module.SITE_URL;
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWindow !== undefined) {
    vi.stubGlobal("window", originalWindow);
  }
  if (originalConfiguredSiteUrl === undefined) {
    delete process.env.EXPO_PUBLIC_SITE_URL;
  } else {
    process.env.EXPO_PUBLIC_SITE_URL = originalConfiguredSiteUrl;
  }
});

describe("site URL resolution", () => {
  it("uses the current trusted browser origin for cookie-backed web sessions", async () => {
    process.env.EXPO_PUBLIC_SITE_URL = "https://www.ticketbylamako.com";

    await expect(
      loadSiteUrl("https://staging.ticketbylamako.com"),
    ).resolves.toBe("https://staging.ticketbylamako.com");
  });

  it("does not trust an unrelated browser origin", async () => {
    process.env.EXPO_PUBLIC_SITE_URL = "https://staging.ticketbylamako.com/";

    await expect(loadSiteUrl("https://attacker.example")).resolves.toBe(
      "https://staging.ticketbylamako.com",
    );
  });

  it("uses the configured site URL outside the browser", async () => {
    process.env.EXPO_PUBLIC_SITE_URL = "https://staging.ticketbylamako.com/";

    await expect(loadSiteUrl(null)).resolves.toBe(
      "https://staging.ticketbylamako.com",
    );
  });
});

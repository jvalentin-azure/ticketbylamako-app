import { afterEach, describe, expect, it, vi } from "vitest";

describe("browser session nonce recovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("restores the HttpOnly cookie session after a stored nonce expires", async () => {
    const values = new Map<string, string>([
      ["ticketbylamako_wp_rest_nonce", "stale-nonce"],
    ]);
    const sessionStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", { sessionStorage });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "rest_cookie_invalid_nonce",
            message: "Cookie check failed",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            nonce: "fresh-nonce",
            user: {
              id: 406,
              email: "qa@example.test",
              displayName: "QA",
              firstName: "QA",
              lastName: "Browser",
              role: "customer",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getStoredUser } = await import("../lib/api/auth.web");
    await expect(getStoredUser()).resolves.toMatchObject({ id: 406 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      headers: expect.objectContaining({ "X-WP-Nonce": "stale-nonce" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    expect(values.get("ticketbylamako_wp_rest_nonce")).toBe("fresh-nonce");
  });

  it("recovers when an intermediary hides the WordPress nonce error body", async () => {
    const values = new Map<string, string>([
      ["ticketbylamako_wp_rest_nonce", "stale-nonce"],
    ]);
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getStoredUser } = await import("../lib/api/auth.web");
    await expect(getStoredUser()).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Accept: "application/json" },
    });
    expect(values.has("ticketbylamako_wp_rest_nonce")).toBe(false);
  });
});

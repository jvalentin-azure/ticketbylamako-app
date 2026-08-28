import { afterEach, describe, expect, it, vi } from "vitest";

describe("browser REST nonce handoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not restore a nonce fetched before an external auth handoff", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    let resolveRefresh!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    );

    const {
      clearWebSessionNonce,
      getWebSessionNonce,
      refreshWebSessionNonce,
    } = await import("../lib/api/web-session.web");
    const staleRefresh = refreshWebSessionNonce();
    clearWebSessionNonce();
    resolveRefresh(
      new Response(
        JSON.stringify({ authenticated: true, nonce: "stale-after-oauth" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(staleRefresh).resolves.toBeNull();
    expect(getWebSessionNonce()).toBeNull();
    expect(values.has("ticketbylamako_wp_rest_nonce")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshWebSessionNonce } = vi.hoisted(() => ({
  refreshWebSessionNonce: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../lib/api/auth", () => ({ getStoredToken: vi.fn() }));
vi.mock("../lib/api/web-session", () => ({
  getWebSessionNonce: () => "stale-nonce",
  refreshWebSessionNonce,
}));

import { mobileV2Fetch } from "../lib/api/mobile";

describe("mobile browser REST nonce recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refreshWebSessionNonce.mockReset();
  });

  it("refreshes an invalid cookie nonce and retries the protected request once", async () => {
    refreshWebSessionNonce.mockResolvedValue("fresh-nonce");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
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
        new Response(JSON.stringify({ flowToken: "flow-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      mobileV2Fetch<{ flowToken: string }>("seating-sessions", {
        method: "POST",
        body: { eventId: 12673 },
      }),
    ).resolves.toEqual({ flowToken: "flow-1" });

    expect(refreshWebSessionNonce).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      headers: expect.objectContaining({ "X-WP-Nonce": "stale-nonce" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: "include",
      headers: expect.objectContaining({ "X-WP-Nonce": "fresh-nonce" }),
    });
  });

  it("does not retry unrelated authorization failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "lamako_v2_forbidden", message: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(mobileV2Fetch("orders")).rejects.toMatchObject({
      status: 403,
      code: "lamako_v2_forbidden",
    });
    expect(refreshWebSessionNonce).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

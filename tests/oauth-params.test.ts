import { describe, expect, it } from "vitest";
import { getOAuthParams } from "@/lib/oauth-params";

describe("OAuth callback parameters", () => {
  it("merges Facebook state from the query with its token fragment", () => {
    const params = getOAuthParams(
      "https://staging.ticketbylamako.com/mobile/oauth/facebook-callback?state=signed-state#access_token=facebook-token&expires_in=3600",
    );

    expect(params.get("state")).toBe("signed-state");
    expect(params.get("access_token")).toBe("facebook-token");
    expect(params.get("expires_in")).toBe("3600");
  });

  it("continues to read Google parameters returned in the fragment", () => {
    const params = getOAuthParams(
      "https://staging.ticketbylamako.com/mobile/oauth/google-callback#state=signed-state&id_token=google-token",
    );

    expect(params.get("state")).toBe("signed-state");
    expect(params.get("id_token")).toBe("google-token");
  });

  it("lets the fragment override duplicate query parameters", () => {
    const params = getOAuthParams(
      "https://staging.ticketbylamako.com/mobile/oauth/facebook-callback?state=old#state=current&access_token=token",
    );

    expect(params.get("state")).toBe("current");
  });

  it("recovers the query when Expo Router folds it behind the fragment", () => {
    const params = getOAuthParams(
      "https://staging.ticketbylamako.com/mobile/oauth/facebook-callback#access_token=facebook-token?state=signed-state",
    );

    expect(params.get("state")).toBe("signed-state");
    expect(params.get("access_token")).toBe("facebook-token");
  });
});

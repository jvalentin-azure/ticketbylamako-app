import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const sessionStart = /\bsession_start\s*\(/;

describe("REST PHP session source attribution", () => {
  it("proves the MU cookie guard configures but never starts a session", () => {
    const guard = read("scripts/tbl-rest-security-hardening.php");

    expect(guard).toContain("session_set_cookie_params");
    expect(guard).toContain("session.use_strict_mode");
    expect(guard).not.toMatch(sessionStart);
  });

  it("proves Mobile v2 route registration and callbacks are PHP-session free", () => {
    const mobileV2 = read("scripts/lamako-mobile-api/includes/v2-commerce.php");

    expect(mobileV2).toContain("'/public/events/(?P<event_id>\\d+)'");
    expect(mobileV2).toContain("'/web-session'");
    expect(mobileV2).toContain("'/rewards/config'");
    expect(mobileV2).toContain("lamako_mobile_v2_public_event");
    expect(mobileV2).toContain("lamako_mobile_v2_get_web_session");
    expect(mobileV2).toContain("lamako_mobile_v2_rewards_config");
    expect(mobileV2).not.toMatch(sessionStart);
  });

  it("proves Rewards and the UX router do not own PHP session startup", () => {
    const rewards = read("scripts/lamako-rewards-api/lamako-rewards-api.php");
    const router = read(
      "scripts/lamako-mobile-api/includes/mobile-web-router.php",
    );

    expect(rewards).not.toMatch(sessionStart);
    expect(router).toContain("defined( 'REST_REQUEST' ) && REST_REQUEST");
    expect(router).not.toMatch(sessionStart);
  });
});

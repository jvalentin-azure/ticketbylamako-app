import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const phpSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "..",
    "scripts",
    "lamako-mobile-api",
    "includes",
    "v2-commerce.php",
  ),
  "utf8",
);
const screenSource = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "edit-profile.tsx"),
  "utf8",
);

describe("authenticated mobile profile", () => {
  it("protects both profile methods with JWT user permissions", () => {
    expect(phpSource).toContain("'/profile'");
    expect(
      phpSource.match(
        /'permission_callback' => 'lamako_mobile_v2_require_user'/g,
      )?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("updates only the current user and rejects duplicate emails", () => {
    expect(phpSource).toContain("$user = wp_get_current_user()");
    expect(phpSource).toContain("lamako_v2_email_exists");
    expect(phpSource).not.toContain("$params['user_id']");
  });

  it("loads the server profile and synchronizes auth after save", () => {
    expect(screenSource).toContain("await getMobileProfile()");
    expect(screenSource).toContain("await updateMobileProfile(");
    expect(screenSource).toContain("await updateCurrentUser(");
  });
});

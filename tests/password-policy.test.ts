import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("customer password policy", () => {
  it("enforces the same strong-password contract in v1 and web-session v2", () => {
    const plugin = readFileSync(
      resolve(root, "scripts/lamako-mobile-api.php"),
      "utf8",
    );
    const v2 = readFileSync(
      resolve(root, "scripts/lamako-mobile-api/includes/v2-commerce.php"),
      "utf8",
    );
    const register = readFileSync(
      resolve(root, "app/(auth)/register.tsx"),
      "utf8",
    );

    expect(plugin).toContain("function lamako_mobile_password_is_strong");
    expect(plugin).toContain("strlen( (string) $password ) >= 10");
    expect(v2).toContain("lamako_mobile_password_is_strong( $password )");
    expect(register).toContain("password.length < 10");
  });
});

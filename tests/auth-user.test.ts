import { describe, expect, it } from "vitest";
import { parseStoredUser } from "@/lib/auth-user";

describe("stored authenticated user", () => {
  it("normalizes a valid legacy user without optional names", () => {
    expect(
      parseStoredUser(
        JSON.stringify({
          id: "42",
          email: " Client@Example.com ",
          displayName: "",
          role: "unexpected-role",
        }),
      ),
    ).toEqual({
      id: 42,
      email: "client@example.com",
      displayName: "client@example.com",
      firstName: "",
      lastName: "",
      role: "customer",
    });
  });

  it("rejects malformed or unusable cache entries", () => {
    expect(parseStoredUser("not-json")).toBeNull();
    expect(parseStoredUser(JSON.stringify({ id: 0, email: "client" }))).toBeNull();
    expect(parseStoredUser(JSON.stringify(["unexpected"]))).toBeNull();
  });
});

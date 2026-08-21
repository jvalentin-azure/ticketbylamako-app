import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const apiSource = fs.readFileSync(
  path.resolve(__dirname, "..", "lib", "_core", "api.ts"),
  "utf8",
);
const callbackSource = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "oauth", "callback.tsx"),
  "utf8",
);

describe("OAuth log safety", () => {
  it("does not log session tokens, OAuth codes, states, cookies, or headers", () => {
    const combined = `${apiSource}\n${callbackSource}`;

    expect(combined).not.toMatch(/console\.(?:log|warn|error)/);
    expect(combined).not.toContain("sessionToken.substring");
    expect(combined).not.toContain("code.substring");
    expect(combined).not.toContain("state.substring");
    expect(combined).not.toContain("Response headers");
    expect(combined).not.toContain("Set-Cookie header received");
  });

  it("keeps user-facing callback states in French", () => {
    expect(callbackSource).toContain("Connexion en cours...");
    expect(callbackSource).toContain("Connexion réussie");
    expect(callbackSource).toContain("Échec de la connexion");
  });
});

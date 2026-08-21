import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "notification-settings.tsx"),
  "utf8",
);

describe("notification settings resilience", () => {
  it("never renders a push token in the interface", () => {
    expect(source).not.toContain("Token:");
    expect(source).not.toContain("pushToken.substring");
  });

  it("provides recoverable load and save failures", () => {
    expect(source).toContain("setLoadError(");
    expect(source).toContain("void loadSettings()");
    expect(source).toContain("setPrefs(previous)");
    expect(source).toContain("Modification non enregistrée");
  });

  it("confirms destructive reminder cleanup", () => {
    expect(source).toContain("Effacer les rappels planifiés ?");
    expect(source).toContain('style: "destructive"');
  });
});

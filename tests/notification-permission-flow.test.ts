import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootLayout = fs.readFileSync(
  path.resolve(__dirname, "..", "app", "_layout.tsx"),
  "utf8",
);
const notifications = fs.readFileSync(
  path.resolve(__dirname, "..", "lib", "notifications.ts"),
  "utf8",
);

describe("push permission flow", () => {
  it("does not request notification permission during app startup", () => {
    expect(rootLayout).not.toContain("registerForPushNotificationsAsync()");
    expect(rootLayout).toContain("registerPushTokenWithBackend()");
  });

  it("keeps automatic backend sync non prompting by default", () => {
    expect(notifications).toContain("requestPermission = false");
    expect(notifications).toContain(
      "registerForPushNotificationsAsync(requestPermission)",
    );
  });
});

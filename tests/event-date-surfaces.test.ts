import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(...segments: string[]) {
  return fs.readFileSync(path.join(root, ...segments), "utf8");
}

describe("event date rendering surfaces", () => {
  it("uses the contractual formatter on detail, list, home and search", () => {
    expect(read("app", "event", "[id].tsx")).toContain(
      "formatEventDate(event)",
    );
    expect(read("components", "event-poster-card.tsx")).toContain(
      "formatEventDateShort(event)",
    );
    expect(read("app", "(tabs)", "index.tsx")).toContain(
      "formatEventDateShort(event)",
    );
    expect(read("app", "search.tsx")).toContain("formatEventDateShort(e)");
  });

  it("does not render or classify against the WordPress publication date", () => {
    for (const file of [
      read("app", "event", "[id].tsx"),
      read("app", "(tabs)", "events.tsx"),
      read("app", "(tabs)", "index.tsx"),
      read("app", "search.tsx"),
      read("components", "event-poster-card.tsx"),
    ]) {
      expect(file).not.toMatch(/formatDate(?:Short)?\([^\n)]*\.date/);
      expect(file).not.toMatch(/new Date\([^\n)]*\.date/);
    }
  });
});

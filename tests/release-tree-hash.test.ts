import { describe, expect, it } from "vitest";

import {
  compareUtf8Bytewise,
  hashReleaseTreeRecords,
} from "../scripts/release-tree-hash";

describe("release tree hash", () => {
  it("sorts paths bytewise like LC_ALL=C, including case-sensitive names", () => {
    const input = ["a.txt", "é.txt", "A.txt", "Z.txt", "_.txt"];

    expect([...input].sort(compareUtf8Bytewise)).toEqual([
      "A.txt",
      "Z.txt",
      "_.txt",
      "a.txt",
      "é.txt",
    ]);
  });

  it("produces a stable aggregate for a case-sensitive inventory fixture", () => {
    const inventory = hashReleaseTreeRecords([
      { path: "a.txt", sha256: "aa".repeat(32), bytes: 1 },
      { path: "A.txt", sha256: "11".repeat(32), bytes: 2 },
      { path: "nested/Z.txt", sha256: "ff".repeat(32), bytes: 3 },
    ]);

    expect(inventory.records.map((record) => record.path)).toEqual([
      "A.txt",
      "a.txt",
      "nested/Z.txt",
    ]);
    expect(inventory.treeSha256).toBe(
      "bd26e0eec4947caefd8c7b60881651e0026d3867aee2bdea7b7ff2f44c7b0afc",
    );
  });

  it("rejects line-breaking paths that would make the canonical inventory ambiguous", () => {
    expect(() =>
      hashReleaseTreeRecords([
        { path: "unsafe\npath.txt", sha256: "11".repeat(32), bytes: 1 },
      ]),
    ).toThrow("Unsafe release-tree path");
  });
});

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type ReleaseTreeRecord = {
  path: string;
  sha256: string;
  bytes: number;
};

export type ReleaseTreeInventory = {
  algorithm: string;
  fileCount: number;
  totalBytes: number;
  treeSha256: string;
  records: ReleaseTreeRecord[];
};

export const RELEASE_TREE_ALGORITHM =
  "sha256(UTF8-no-BOM LF(paths sorted by UTF-8 bytes as LC_ALL=C, lines `sha256  ./relative/path\\n`, one final LF))";

export function compareUtf8Bytewise(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    /[\r\n]/.test(normalized)
  ) {
    throw new Error(`Unsafe release-tree path: ${relativePath}`);
  }
  return normalized;
}

export function hashReleaseTreeRecords(
  records: readonly ReleaseTreeRecord[],
): ReleaseTreeInventory {
  const normalizedRecords = records.map((record) => {
    const normalizedPath = normalizeRelativePath(record.path);
    const normalizedHash = record.sha256.toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
      throw new Error(`Invalid SHA-256 for ${normalizedPath}`);
    }
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0) {
      throw new Error(`Invalid byte count for ${normalizedPath}`);
    }
    return { path: normalizedPath, sha256: normalizedHash, bytes: record.bytes };
  });

  normalizedRecords.sort((left, right) =>
    compareUtf8Bytewise(left.path, right.path),
  );

  for (let index = 1; index < normalizedRecords.length; index += 1) {
    if (normalizedRecords[index - 1].path === normalizedRecords[index].path) {
      throw new Error(
        `Duplicate release-tree path: ${normalizedRecords[index].path}`,
      );
    }
  }

  const canonicalInventory = normalizedRecords
    .map((record) => `${record.sha256}  ./${record.path}\n`)
    .join("");

  return {
    algorithm: RELEASE_TREE_ALGORITHM,
    fileCount: normalizedRecords.length,
    totalBytes: normalizedRecords.reduce((sum, record) => sum + record.bytes, 0),
    treeSha256: createHash("sha256")
      .update(canonicalInventory, "utf8")
      .digest("hex"),
    records: normalizedRecords,
  };
}

async function collectDirectoryRecords(
  rootDirectory: string,
  segments: string[] = [],
): Promise<ReleaseTreeRecord[]> {
  const absoluteDirectory = path.join(rootDirectory, ...segments);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const records: ReleaseTreeRecord[] = [];

  for (const entry of entries) {
    const nextSegments = [...segments, entry.name];
    const relativePath = nextSegments.join("/");
    const absolutePath = path.join(rootDirectory, ...nextSegments);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in a release tree: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      records.push(...(await collectDirectoryRecords(rootDirectory, nextSegments)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported release-tree entry: ${relativePath}`);
    }

    const contents = await readFile(absolutePath);
    records.push({
      path: relativePath,
      sha256: createHash("sha256").update(contents).digest("hex"),
      bytes: contents.length,
    });
  }

  return records;
}

export async function hashReleaseTree(
  rootDirectory: string,
): Promise<ReleaseTreeInventory> {
  const absoluteRoot = path.resolve(rootDirectory);
  const metadata = await stat(absoluteRoot);
  if (!metadata.isDirectory()) {
    throw new Error(`Release-tree root is not a directory: ${absoluteRoot}`);
  }
  return hashReleaseTreeRecords(await collectDirectoryRecords(absoluteRoot));
}

async function main(): Promise<void> {
  const rootDirectory = process.argv[2];
  if (!rootDirectory) {
    throw new Error("Usage: tsx scripts/release-tree-hash.ts <directory>");
  }
  process.stdout.write(`${JSON.stringify(await hashReleaseTree(rootDirectory), null, 2)}\n`);
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

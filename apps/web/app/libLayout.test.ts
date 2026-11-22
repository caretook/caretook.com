import { readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The layout guard for app/lib (code-layout PRD): one folder per area, named
// after its docs/domain/ doc, plus core/ (helpers no one area owns) and sync/
// (the sync plumbing only). Device queries are <name>.sync.ts in their area's
// folder. Imports are direct file paths, so there are no index files to keep.

const lib = new URL("./lib/", import.meta.url);
const domainDocs = new URL("../../../docs/domain/", import.meta.url);

/** Modules allowed directly under lib/ (none: every module has a folder). */
const TOP_LEVEL: string[] = [];

/**
 * lib/sync/: the client, the device schema, the lazy front door, the page
 * cache, live rows, first sync, and the tile cache (remembered live answers).
 */
const SYNC_PLUMBING = [
  "client.test.ts",
  "client.ts",
  "firstSync.ts",
  "index.test.ts",
  "index.ts",
  "pageCache.test.ts",
  "pageCache.ts",
  "remembered.test.ts",
  "remembered.ts",
  "schema.ts",
  "useLiveRows.ts",
  "useRememberedQuery.ts",
];

const areas = readdirSync(domainDocs)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3));

/** Every file under lib/, as a path relative to it. */
const files = readdirSync(lib, { recursive: true, encoding: "utf8" }).filter((f) =>
  statSync(new URL(f, lib)).isFile(),
);

const folderOf = (f: string) => (f.includes("/") ? f.slice(0, f.indexOf("/")) : null);

describe("app/lib layout", () => {
  it("has no module directly under lib/", () => {
    expect(files.filter((f) => !f.includes("/") && !TOP_LEVEL.includes(f))).toEqual([]);
  });

  it("names every folder after an area doc, or core or sync", () => {
    const folders = new Set(files.map(folderOf).filter((f) => f !== null));
    expect([...folders].filter((f) => f !== "core" && f !== "sync" && !areas.includes(f))).toEqual([]);
  });

  it("keeps only the sync plumbing in lib/sync/", () => {
    const inSync = files.filter((f) => f.startsWith("sync/")).map((f) => f.slice("sync/".length));
    expect(inSync.filter((f) => !SYNC_PLUMBING.includes(f))).toEqual([]);
  });

  it("puts every device query (*.sync.ts) in an area folder", () => {
    const misplaced = files
      .filter((f) => /\.sync\.(tsx?|test\.ts|browser\.test\.tsx)$/.test(f))
      .filter((f) => {
        const folder = folderOf(f);
        return folder === null || folder === "core" || folder === "sync" || !areas.includes(folder);
      });
    expect(misplaced).toEqual([]);
  });

  it("has no index files (imports name the module)", () => {
    expect(files.filter((f) => /(^|\/)index\.tsx?$/.test(f) && f !== "sync/index.ts")).toEqual([]);
  });
});

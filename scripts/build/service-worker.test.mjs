import { describe, expect, it } from "vitest";

import { precacheList, SQLITE_WASM } from "./manifest.mjs";
import { serviceWorkerVersion } from "./service-worker.mjs";

// A trimmed assets/ directory: the entry, its CSS and fonts, a shared and a
// lazy chunk, the route manifest, an image, and PowerSync's database worker
// bundle (B-777): its own chunks, which Vite's client manifest doesn't list,
// and the four SQLite builds' WASM.
const files = [
  "root-a1.js",
  "app-b2.css",
  "Font-Variable-k1.woff2",
  "Font-Italic-Variable-k2.woff2",
  "logo-m3.png",
  "utils-c3.js",
  "notes-e5.js",
  "manifest-h8.js",
  "worker-q4.js",
  "IDBBatchAtomicVFS-r5.js",
  "wa-sqlite-async-j9.js",
  "wa-sqlite-async-Ab_9-x.wasm",
  "wa-sqlite-g7.wasm",
  "mc-wa-sqlite-async-p2.wasm",
  "mc-wa-sqlite-s6.wasm",
];

describe("precacheList", () => {
  it("lists the shell first, then every JS, CSS and font file in assets/ once, and the SQLite WASM", () => {
    expect(precacheList({ files: [...files, "root-a1.js"] })).toEqual([
      "/app",
      "/assets/Font-Italic-Variable-k2.woff2",
      "/assets/Font-Variable-k1.woff2",
      "/assets/IDBBatchAtomicVFS-r5.js",
      "/assets/app-b2.css",
      "/assets/manifest-h8.js",
      "/assets/notes-e5.js",
      "/assets/root-a1.js",
      "/assets/utils-c3.js",
      "/assets/wa-sqlite-async-Ab_9-x.wasm",
      "/assets/wa-sqlite-async-j9.js",
      "/assets/worker-q4.js",
    ]);
  });

  // B-777: offline, PowerSync's database worker gets these through the service
  // worker at every start; without them the database can't open.
  it("precaches the database worker's own chunks and the WASM it loads (async, unencrypted)", () => {
    const list = precacheList({ files });
    expect(list).toContain("/assets/worker-q4.js");
    expect(list).toContain("/assets/IDBBatchAtomicVFS-r5.js");
    expect(list.filter((path) => path.endsWith(".wasm"))).toEqual(["/assets/wa-sqlite-async-Ab_9-x.wasm"]);
  });

  it("leaves images and the other SQLite builds out", () => {
    const list = precacheList({ files });
    expect(list).not.toContain("/assets/logo-m3.png");
    for (const wasm of ["wa-sqlite-g7.wasm", "mc-wa-sqlite-async-p2.wasm", "mc-wa-sqlite-s6.wasm"])
      expect(list).not.toContain(`/assets/${wasm}`);
  });

  it("matches only the unencrypted async build's WASM", () => {
    expect(SQLITE_WASM.test("wa-sqlite-async-B3FiUnt1.wasm")).toBe(true);
    expect(SQLITE_WASM.test("mc-wa-sqlite-async-aRcIGeKj.wasm")).toBe(false);
    expect(SQLITE_WASM.test("wa-sqlite-CePoIZt_.wasm")).toBe(false);
    expect(SQLITE_WASM.test("wa-sqlite-async-Bi9nxNBX.js")).toBe(false);
  });
});

describe("serviceWorkerVersion", () => {
  const list = ["/app", "/assets/root-a1.js"];
  it("is stable for the same build", () => {
    expect(serviceWorkerVersion(list, ["worker source"])).toBe(serviceWorkerVersion([...list], ["worker source"]));
    expect(serviceWorkerVersion(list, ["worker source"])).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes with the assets or the worker's source", () => {
    const base = serviceWorkerVersion(list, ["worker source"]);
    expect(serviceWorkerVersion(["/app", "/assets/root-z9.js"], ["worker source"])).not.toBe(base);
    expect(serviceWorkerVersion(list, ["worker source, edited"])).not.toBe(base);
  });
});

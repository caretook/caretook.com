import { describe, expect, it } from "vitest";

import { precacheList } from "./manifest.mjs";
import { serviceWorkerVersion } from "./service-worker.mjs";

// A trimmed Vite client manifest: the entry (with the fonts its CSS uses), a
// route with CSS, a shared chunk, a lazy chunk, SQLite's WASM as a chunk's
// asset, and an image.
const viteManifest = {
  "app/root.tsx": {
    file: "assets/root-a1.js",
    imports: ["_utils-c3.js"],
    css: ["assets/app-b2.css"],
    assets: ["assets/Font-Variable-k1.woff2", "assets/Font-Italic-Variable-k2.woff2", "assets/logo-m3.png"],
    isEntry: true,
  },
  "app/fonts/Font-Variable.woff2": { file: "assets/Font-Variable-k1.woff2" },
  "_utils-c3.js": { file: "assets/utils-c3.js" },
  "app/routes/app/layout/route.tsx": { file: "assets/route-d4.js", dynamicImports: ["_notes-e5.js"] },
  "_notes-e5.js": { file: "assets/notes-e5.js", isDynamicEntry: true },
  "node_modules/@journeyapps/wa-sqlite/dist/wa-sqlite.mjs": {
    file: "assets/wa-sqlite-f6.js",
    assets: ["assets/wa-sqlite-g7.wasm"],
  },
  "app/app.css?url": { file: "assets/app-b2.css" },
};

describe("precacheList", () => {
  it("lists the shell first, then every JS, CSS and font file once, with the route manifest", () => {
    expect(precacheList({ viteManifest, routeManifestFile: "assets/manifest-h8.js" })).toEqual([
      "/app",
      "/assets/Font-Italic-Variable-k2.woff2",
      "/assets/Font-Variable-k1.woff2",
      "/assets/app-b2.css",
      "/assets/manifest-h8.js",
      "/assets/notes-e5.js",
      "/assets/root-a1.js",
      "/assets/route-d4.js",
      "/assets/utils-c3.js",
      "/assets/wa-sqlite-f6.js",
    ]);
  });

  it("leaves the WASM and images out: nothing but scripts, styles and fonts", () => {
    const [shell, ...assets] = precacheList({ viteManifest, routeManifestFile: "assets/manifest-h8.js" });
    expect(shell).toBe("/app");
    expect(assets.filter((path) => !/\.(js|css|woff2)$/.test(path))).toEqual([]);
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

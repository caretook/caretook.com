import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin, type Rolldown } from "vite";

import { clientChunks as lucideChunks } from "../../scripts/build/chunks.mjs";

// Server-side env for dev and builds: apps/web/.env (auth), then
// packages/data/.env (DATABASE_URL), so there's one copy of each value. Real
// env vars win, and missing files are fine (Vercel sets real env vars).
// Not under Vitest: the web:components project extends this config in the same
// process as the integration project, and the dev DATABASE_URL loaded here
// would win over packages/data/.env.test(.local).
if (!process.env.VITEST) {
  for (const file of [".env", "../../packages/data/.env"]) {
    try {
      process.loadEnvFile(new URL(file, import.meta.url));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}

// The bundle budget (scripts/build/) needs to know which source modules each
// client chunk holds, which Vite's manifest doesn't list: write them beside it.
const chunkModules = (): Plugin => ({
  name: "caretook:chunk-modules",
  apply: "build",
  applyToEnvironment: (environment) => environment.name === "client",
  generateBundle(_options, bundle) {
    const chunks: Record<string, string[]> = {};
    for (const [file, item] of Object.entries(bundle)) {
      if (item.type === "chunk") chunks[file] = Object.keys(item.modules);
    }
    this.emitFile({ type: "asset", fileName: ".vite/chunk-modules.json", source: JSON.stringify(chunks) });
  },
});

// Client chunk groups (B-960, B-966): React, lucide-react's own code, the
// icons only the app reaches in one `icons` chunk (the public pages never load
// it), and the public pages' icons by page. The plugin reads which icons each
// module imports. The rules and why: scripts/build/chunks.mjs; `pnpm build:budget`
// checks the shape.
const clientChunks = lucideChunks<Plugin, Rolldown.CodeSplittingOptions>();

export default defineConfig({
  // VITE_* as usual, plus APP_ENV (staging | production): it's public, and
  // prerendered pages and every page's noindex read it at build (lib/marketing/noindex.ts).
  envPrefix: ["VITE_", "APP_ENV"],
  // The build target (web | native), for client code: only web builds register the service worker.
  // (build-target.ts's rule, read here directly: Vite's native config loader can't import it.)
  define: {
    "import.meta.env.BUILD_TARGET": JSON.stringify(process.env.BUILD_TARGET === "native" ? "native" : "web"),
  },
  // Component tests (Vitest's `web:components` project) load this config for
  // `~/`, Tailwind, daisyUI and the dedupes, but render routes in React
  // Router's test stub: the framework plugin isn't for tests.
  plugins: [tailwindcss(), !process.env.VITEST && reactRouter(), chunkModules(), clientChunks.plugin],
  // The bundle budget reads .vite/manifest.json from the web client build.
  build: { manifest: true },
  // Both targets' client builds (the server build keeps its default split).
  environments: {
    client: { build: { rolldownOptions: { output: { codeSplitting: clientChunks.codeSplitting } } } },
  },
  // One copy each of yjs (Yjs breaks with two: its `instanceof` checks fail),
  // React, and ProseMirror's packages.
  resolve: {
    tsconfigPaths: true,
    dedupe: ["yjs", "react", "react-dom", "prosemirror-model", "prosemirror-state", "prosemirror-view"],
  },
  // IPv4 loopback, not "localhost" (which Node binds to [::1] only): the
  // PowerSync container fetches Better Auth's JWKS through
  // host.docker.internal, which Docker Desktop forwards to 127.0.0.1 (and
  // Vite refuses unknown Host headers).
  // WEB_PORT (a loop's apps/web/.env) pins the port; a CLI --port still wins.
  server: {
    host: "127.0.0.1",
    allowedHosts: ["host.docker.internal"],
    ...(process.env.WEB_PORT && { port: Number(process.env.WEB_PORT), strictPort: true }),
  },
  // PowerSync runs SQLite (WASM) in web workers. Pre-bundling breaks the
  // worker and WASM URLs, and the workers are ES modules.
  //
  // The editor's packages are pre-bundled up front, in one pass, so yjs is
  // shared rather than copied into each bundle, and opening live notes for
  // the first time doesn't re-optimize (which reloads the page mid-session).
  optimizeDeps: {
    exclude: ["@powersync/web"],
    include: [
      "yjs",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-collaboration",
      "@tiptap/y-tiptap",
      "@tiptap/extension-mention",
      "@tiptap/suggestion",
    ],
  },
  worker: { format: "es" },
});

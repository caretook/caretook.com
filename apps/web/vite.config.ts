import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Server-side env for dev and builds: apps/web/.env (auth), then
// packages/data/.env (DATABASE_URL), so there's one copy of each value. Real
// env vars win, and missing files are fine (Vercel sets real env vars).
for (const file of [".env", "../../packages/data/.env"]) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
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
    ],
  },
  worker: { format: "es" },
});

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

import { PRERENDER_PATHS } from "./app/routes/marketing/site/pages";
import { isNative } from "./build-target";

// Vercel's preset (hosting slice 1): web builds on Vercel only (`vercel build`
// sets VERCEL=1). It splits the server into Vercel functions and writes
// .vercel/react-router-build-result.json for Vercel's builder. Local and check
// builds keep build/web/server/index.js for react-router-serve; native has no server.
const onVercel = !isNative && Boolean(process.env.VERCEL);

// The service worker (B-144), web builds only: after the build, write
// client/sw.js with its precache list (scripts/build/service-worker.mjs).
// Vercel's preset has a buildEnd too; React Router runs both.
const writeServiceWorker: NonNullable<Config["buildEnd"]> = ({
  reactRouterConfig: { appDirectory, buildDirectory },
}) => {
  const script = join(appDirectory, "../../../scripts/build/service-worker.mjs");
  const run = spawnSync(process.execPath, [script, join(buildDirectory, "client")], { stdio: "inherit" });
  if (run.status !== 0) throw new Error("writing the service worker (sw.js) failed");
};

export default {
  ssr: !isNative,
  buildDirectory: isNative ? "build/native" : "build/web",
  // The whole route manifest ships with the first page. Lazy discovery would
  // ask the server (/__manifest) before navigating to a path it hasn't seen,
  // such as a note saved offline (/entries/:id), and fail without a network.
  routeDiscovery: { mode: "initial" },
  // The marketing site is static: its pages, sitemap.xml and robots.txt are
  // prerendered to files in the web build. Native has no marketing routes.
  ...(!isNative && { prerender: PRERENDER_PATHS }),
  ...(onVercel && { presets: [vercelPreset()] }),
  ...(!isNative && { buildEnd: writeServiceWorker }),
} satisfies Config;

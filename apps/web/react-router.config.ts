import type { Config } from "@react-router/dev/config";

import { PRERENDER_PATHS } from "./app/routes/marketing/site/pages";
import { isNative } from "./build-target";

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
} satisfies Config;

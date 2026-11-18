import type { Config } from "@react-router/dev/config";

import { isNative } from "./build-target";

export default {
  ssr: !isNative,
  buildDirectory: isNative ? "build/native" : "build/web",
  // The whole route manifest ships with the first page. Lazy discovery would
  // ask the server (/__manifest) before navigating to a path it hasn't seen,
  // such as a note saved offline (/entries/:id), and fail without a network.
  routeDiscovery: { mode: "initial" },
} satisfies Config;

import type { Config } from "@react-router/dev/config";

import { isNative } from "./build-target";

export default {
  ssr: !isNative,
  buildDirectory: isNative ? "build/native" : "build/web",
} satisfies Config;

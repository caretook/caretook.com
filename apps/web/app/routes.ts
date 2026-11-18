import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

import { isNative } from "../build-target";

// Shared app screens: client-only data (local DB + oRPC). Present in both targets.
const appRoutes = [
  ...prefix("app", [
    layout("routes/app/layout.tsx", [
      index("routes/app/home.tsx"),
      route("groups/:groupId/timeline", "routes/app/timeline.tsx"),
      route("groups/:groupId/entries/:entryId/notes", "routes/app/entry-notes.tsx"),
      route("settings", "routes/app/settings.tsx"),
    ]),
  ]),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
];

// Web-only: marketing, auth callbacks, anything needing server loaders.
const webRoutes = [
  index("routes/marketing/home.tsx"),
  route("api/auth/*", "routes/api/auth.ts"),
  route("rpc/*", "routes/rpc.ts"),
];

// Native-only: the bundled app has no marketing site, so "/" goes straight to /app.
const nativeRoutes = [index("routes/native-index.tsx")];

export default [...(isNative ? nativeRoutes : webRoutes), ...appRoutes] satisfies RouteConfig;

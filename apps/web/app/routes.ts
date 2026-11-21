import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

import { isNative } from "../build-target";
import { adminRoutes } from "./routes/admin/routes";
import { entryRoutes } from "./routes/app/groups/entry/routes";
import { medicationRoutes } from "./routes/app/groups/medications/routes";
import { newGroupRoutes } from "./routes/app/groups/new/routes";
import { periodRoutes } from "./routes/app/groups/periods/routes";
import { profileRoutes } from "./routes/app/groups/profile/routes";
import { providerRoutes } from "./routes/app/groups/providers/routes";
import { searchRoutes } from "./routes/app/groups/search/routes";
import { groupSettingsRoutes } from "./routes/app/groups/settings/routes";
import { taskRoutes } from "./routes/app/groups/tasks/routes";
import { timelineRoutes } from "./routes/app/groups/timeline/routes";
import { upcomingRoutes } from "./routes/app/groups/upcoming/routes";
import { googleCalendarRoutes } from "./routes/api/google/routes";
import { accountSettingsRoutes } from "./routes/app/settings/routes";
import { connectorRoutes } from "./routes/connectors/routes";
import { notificationRoutes } from "./routes/dev/routes";
import { marketingRoutes } from "./routes/marketing/routes";

// The frame: the `/app` layout, the group layout, the account pages and the
// web/native split. Each area lists its own routes in a `routes.ts` beside its
// route folders and they're spread in here.
//
// Shared app screens: client-only data (local DB + oRPC). Present in both targets.
// Each route module is `route.tsx` in its own folder, beside the files only it uses.
// Nested where the UI is nested: the group route loads the group once for every
// screen inside it. Later group sections (Medications, Providers…) are new
// children of `groups/:groupId`, their pieces appended at the end of its list.
const appRoutes = [
  ...prefix("app", [
    layout("routes/app/layout/route.tsx", { id: "app" }, [
      index("routes/app/home/route.tsx"),
      ...accountSettingsRoutes,
      route("groups/:groupId", "routes/app/groups/layout/route.tsx", { id: "group" }, [
        index("routes/app/groups/index/route.tsx"),
        ...timelineRoutes,
        ...entryRoutes,
        ...groupSettingsRoutes,
        ...providerRoutes,
        ...medicationRoutes,
        ...upcomingRoutes,
        ...profileRoutes,
        ...searchRoutes,
        ...periodRoutes,
        ...taskRoutes,
      ]),
      ...newGroupRoutes,
    ]),
  ]),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  // Signed-out account pages, reached from emailed links and from sign-in.
  route("reset-password", "routes/account/reset-password/route.tsx"),
  route("verify-email", "routes/account/verify-email/route.tsx"),
  // An emailed invite's link: sign up or sign in, agree, join (or decline).
  route("invite/:token", "routes/account/invite/route.tsx"),
  // A staff access code's link (or QR): an account and a new care group.
  route("join/:code", "routes/account/join/route.tsx"),
];

// Web-only: marketing, auth callbacks, anything needing server loaders.
const webRoutes = [
  ...marketingRoutes,
  route("api/auth/*", "routes/api/auth.ts"),
  route("rpc/*", "routes/rpc.ts"),
  ...notificationRoutes,
  ...adminRoutes,
  ...connectorRoutes,
  ...googleCalendarRoutes,
];

// Native-only: the bundled app has no marketing site, so "/" goes straight to /app.
const nativeRoutes = [index("routes/native-index.tsx")];

// The web-only routes sit in a pathless layout whose middleware adds the
// security headers to resource routes (routes/web/route.ts; documents get them
// in entry.server.tsx).
export const composeRoutes = (native: boolean) =>
  [
    ...(native ? nativeRoutes : [layout("routes/web/route.ts", { id: "web" }, webRoutes)]),
    ...appRoutes,
  ] satisfies RouteConfig;

export default composeRoutes(isNative);

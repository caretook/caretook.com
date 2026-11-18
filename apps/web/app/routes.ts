import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

import { isNative } from "../build-target";

// Shared app screens: client-only data (local DB + oRPC). Present in both targets.
// Each route module is `route.tsx` in its own folder, beside the files only it uses.
// Nested where the UI is nested: the group route loads the group once for every
// screen inside it. Later group sections (Medications, Providers…) are new
// children of `groups/:groupId`, appended at the end of its list.
const appRoutes = [
  ...prefix("app", [
    layout("routes/app/layout/route.tsx", { id: "app" }, [
      index("routes/app/home/route.tsx"),
      route("settings", "routes/app/settings/layout/route.tsx", [
        index("routes/app/settings/index/route.tsx"),
        route("units", "routes/app/settings/units/route.tsx"),
        route("timeline", "routes/app/settings/timeline/route.tsx"),
        route("account", "routes/app/settings/account/route.tsx"),
      ]),
      route("groups/:groupId", "routes/app/groups/layout/route.tsx", { id: "group" }, [
        index("routes/app/groups/index/route.tsx"),
        route("timeline", "routes/app/groups/timeline/route.tsx", [
          // Sheets over the timeline, which stays mounted underneath.
          route("new/:kind", "routes/app/groups/timeline/new/route.tsx"),
          route(":entryId/edit", "routes/app/groups/timeline/edit/route.tsx"),
        ]),
        route("entries/:entryId", "routes/app/groups/entry/route.tsx"),
        route("settings", "routes/app/groups/settings/layout/route.tsx", [
          index("routes/app/groups/settings/index/route.tsx"),
          route("details", "routes/app/groups/settings/details/route.tsx"),
          route("members", "routes/app/groups/settings/members/route.tsx"),
        ]),
      ]),
    ]),
  ]),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
];

// Web-only: marketing, auth callbacks, anything needing server loaders.
const webRoutes = [
  // The marketing site: prerendered at build (react-router.config.ts); its
  // paths are listed in routes/marketing/site/pages.ts. New pages append here.
  layout("routes/marketing/layout/route.tsx", { id: "marketing" }, [
    index("routes/marketing/home/route.tsx"),
    route("features", "routes/marketing/features/route.tsx"),
    route("faq", "routes/marketing/faq/route.tsx"),
    route("about", "routes/marketing/about/route.tsx"),
    route("contact", "routes/marketing/contact/route.tsx"),
    route("privacy", "routes/marketing/privacy/route.tsx"),
    route("terms", "routes/marketing/terms/route.tsx"),
    route("health-data-privacy", "routes/marketing/health-data-privacy/route.tsx"),
  ]),
  route("api/auth/*", "routes/api/auth.ts"),
  route("rpc/*", "routes/rpc.ts"),
  route("sitemap.xml", "routes/marketing/sitemap/route.ts"),
  route("robots.txt", "routes/marketing/robots/route.ts"),
];

// Native-only: the bundled app has no marketing site, so "/" goes straight to /app.
const nativeRoutes = [index("routes/native-index.tsx")];

export default [...(isNative ? nativeRoutes : webRoutes), ...appRoutes] satisfies RouteConfig;

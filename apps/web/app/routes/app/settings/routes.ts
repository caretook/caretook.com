import { type RouteConfigEntry, index, route } from "@react-router/dev/routes";

// The account's settings: the list and its subpages (a child of the `/app` layout).
export const accountSettingsRoutes: RouteConfigEntry[] = [
  route("settings", "routes/app/settings/layout/route.tsx", [
    index("routes/app/settings/index/route.tsx"),
    route("units", "routes/app/settings/units/route.tsx"),
    route("timeline", "routes/app/settings/timeline/route.tsx"),
    route("account", "routes/app/settings/account/route.tsx"),
    route("contact", "routes/app/settings/contact/route.tsx"),
    route("devices", "routes/app/settings/devices/route.tsx"),
  ]),
];

import { type RouteConfigEntry, index, route } from "@react-router/dev/routes";

// A group's settings (care groups; a child of `groups/:groupId`).
export const groupSettingsRoutes: RouteConfigEntry[] = [
  route("settings", "routes/app/groups/settings/layout/route.tsx", [
    index("routes/app/groups/settings/index/route.tsx"),
    route("details", "routes/app/groups/settings/details/route.tsx"),
    route("members", "routes/app/groups/settings/members/route.tsx"),
  ]),
];

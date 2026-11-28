import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// A group's setup pages (onboarding-2; app-shell): the layout with progress, Next and Later, and a page per
// step. Each step's page is a static child, so it wins over `:step?`, which sends an unknown or missing step
// to the first.
export const setupRoutes: RouteConfigEntry[] = [
  route("setup", "routes/app/groups/setup/layout/route.tsx", [
    route("providers", "routes/app/groups/setup/providers/route.tsx"),
    route(":step?", "routes/app/groups/setup/step/route.tsx"),
  ]),
];

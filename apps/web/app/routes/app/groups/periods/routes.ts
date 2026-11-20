import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Care periods (where care happens, over time; not a section): the
// page with its sheets as children, and a period's page.
export const periodRoutes: RouteConfigEntry[] = [
  route("periods", "routes/app/groups/periods/route.tsx", [
    route("new", "routes/app/groups/periods/new/route.tsx"),
    route(":periodId/edit", "routes/app/groups/periods/edit/route.tsx"),
  ]),
  route("periods/:periodId", "routes/app/groups/period/route.tsx"),
];

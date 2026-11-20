import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The provider directory and a provider's page (children of `groups/:groupId`).
export const providerRoutes: RouteConfigEntry[] = [
  route("providers", "routes/app/groups/providers/route.tsx", [
    // Sheets over the directory, which stays mounted underneath.
    route("new", "routes/app/groups/providers/new/route.tsx"),
    route(":providerId/edit", "routes/app/groups/providers/edit/route.tsx"),
  ]),
  route("providers/:providerId", "routes/app/groups/provider/route.tsx"),
];

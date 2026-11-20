import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// A note's or event's page (live notes; a child of `groups/:groupId`).
export const entryRoutes: RouteConfigEntry[] = [
  route("entries/:entryId", "routes/app/groups/entry/route.tsx"),
];

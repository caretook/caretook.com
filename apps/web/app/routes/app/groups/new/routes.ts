import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Start another care group (a sheet over its own page; not a group route).
export const newGroupRoutes: RouteConfigEntry[] = [route("groups/new", "routes/app/groups/new/route.tsx")];

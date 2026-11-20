import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Search the group's entries, providers and medications (not a section; the header's magnifier).
export const searchRoutes: RouteConfigEntry[] = [route("search", "routes/app/groups/search/route.tsx")];

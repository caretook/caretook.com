import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Appointments and reminders still to come, and the Past tab (past events).
export const upcomingRoutes: RouteConfigEntry[] = [
  route("upcoming", "routes/app/groups/upcoming/route.tsx"),
  route("upcoming/past", "routes/app/groups/upcoming/past/route.tsx"),
];

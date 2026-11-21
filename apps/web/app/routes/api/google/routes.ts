import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Google Calendar (web only; calendars, appointments-2): Connect and
// Google's OAuth callback, both server routes that redirect.
export const googleCalendarRoutes: RouteConfigEntry[] = [
  route("api/google/connect", "routes/api/google/connect.ts"),
  route("api/google/callback", "routes/api/google/callback.ts"),
];

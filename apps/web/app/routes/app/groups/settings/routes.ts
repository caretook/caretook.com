import { type RouteConfigEntry, index, route } from "@react-router/dev/routes";

// A group's settings (care groups; a child of `groups/:groupId`).
export const groupSettingsRoutes: RouteConfigEntry[] = [
  route("settings", "routes/app/groups/settings/layout/route.tsx", [
    index("routes/app/groups/settings/index/route.tsx"),
    route("details", "routes/app/groups/settings/details/route.tsx"),
    route("members", "routes/app/groups/settings/members/route.tsx"),
    // Members' own AI assistants (connectors): the owners' switch and the group's connections.
    route("assistants", "routes/app/groups/settings/assistants/route.tsx"),
    // Calendar & reminders (calendars, appointments-2): each member's own reminders, feed, Google and details.
    route("calendar", "routes/app/groups/settings/calendar/route.tsx"),
  ]),
];

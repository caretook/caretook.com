import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The group's tasks (a section): the list, with its add and edit sheets as
// children, and a task's page (its details and live notes).
export const taskRoutes: RouteConfigEntry[] = [
  route("tasks", "routes/app/groups/tasks/route.tsx", [
    route("new", "routes/app/groups/tasks/new/route.tsx"),
    route(":taskId/edit", "routes/app/groups/tasks/edit/route.tsx"),
  ]),
  route("tasks/:taskId", "routes/app/groups/task/route.tsx"),
];

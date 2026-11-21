import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The group's todos (a section): the list, with its add and edit sheets as
// children, and a todo's page (its details and live notes).
export const todoRoutes: RouteConfigEntry[] = [
  route("todos", "routes/app/groups/todos/route.tsx", [
    route("new", "routes/app/groups/todos/new/route.tsx"),
    route(":todoId/edit", "routes/app/groups/todos/edit/route.tsx"),
  ]),
  route("todos/:todoId", "routes/app/groups/todo/route.tsx"),
];

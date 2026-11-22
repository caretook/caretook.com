import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The Planner section: its Planner tab (appointments, due doses
// and dated todos still to come) and its Past tab (past events). Its Todos
// tab is the todos area's route (`todos/routes.ts`).
export const plannerRoutes: RouteConfigEntry[] = [
  route("planner", "routes/app/groups/planner/route.tsx"),
  route("planner/past", "routes/app/groups/planner/past/route.tsx"),
];

import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The medication list (its sheets come as its children), a medication's page
// and the print and passes pages (children of `groups/:groupId`).
export const medicationRoutes: RouteConfigEntry[] = [
  route("medications", "routes/app/groups/medications/route.tsx", [
    // Sheets over the list, which stays mounted underneath (`new` is
    // static, so it ranks above the page's `:medicationId`).
    route("new", "routes/app/groups/medications/new/route.tsx"),
    route(":medicationId/edit", "routes/app/groups/medications/edit/route.tsx"),
    // The recipient's allergies (writers), opened from the list and from a medication's page.
    route("allergies", "routes/app/groups/medications/allergies/route.tsx"),
  ]),
  route("medications/:medicationId", "routes/app/groups/medication/route.tsx"),
  // The printable sheet (a static segment, so it ranks above `:medicationId`).
  route("medications/print", "routes/app/groups/medications/print/route.tsx"),
  // The group's medication passes (Morning, Evening…; a static segment, like print).
  route("medications/passes", "routes/app/groups/medications/passes/route.tsx"),
  // The weekly bedside sheet (`?start=YYYY-MM-DD`; a static segment, like print).
  route("medications/print/week", "routes/app/groups/medications/print/week/route.tsx"),
];

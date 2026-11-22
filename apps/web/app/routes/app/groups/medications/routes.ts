import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Sheets over a tab, which stays mounted underneath (`new` is static, so it
// ranks above `:medicationId/edit`). The same modules serve both tabs, so
// each gets an id of its own.
const sheets = (tab: "schedule" | "list"): RouteConfigEntry[] => [
  route("new", "routes/app/groups/medications/new/route.tsx", { id: `medications-${tab}-new` }),
  route(":medicationId/edit", "routes/app/groups/medications/edit/route.tsx", {
    id: `medications-${tab}-edit`,
  }),
  // The recipient's allergies (writers), opened from the list and from a medication's page.
  route("allergies", "routes/app/groups/medications/allergies/route.tsx", {
    id: `medications-${tab}-allergies`,
  }),
];

// The Medications page (the header and its three tabs: Schedule and the
// list, each with the sheets as children, and Passes, with the add-pass
// sheet), a medication's page and the print pages (children of
// `groups/:groupId`). Plain `medications` has no index and no redirect:
// every link goes to a tab.
export const medicationRoutes: RouteConfigEntry[] = [
  route("medications", "routes/app/groups/medications/route.tsx", [
    // Static segments, so they rank above `medications/:medicationId`.
    route("schedule", "routes/app/groups/medications/schedule/route.tsx", sheets("schedule")),
    route("list", "routes/app/groups/medications/list/route.tsx", sheets("list")),
    // The group's medication passes (Morning, Evening…); editing one is a sheet in the tab.
    route("passes", "routes/app/groups/medications/passes/route.tsx", [
      route("new", "routes/app/groups/medications/passes/new/route.tsx"),
    ]),
  ]),
  route("medications/:medicationId", "routes/app/groups/medication/route.tsx"),
  // The printable sheet (a static segment, so it ranks above `:medicationId`).
  route("medications/print", "routes/app/groups/medications/print/route.tsx"),
  // The weekly bedside sheet (`?start=YYYY-MM-DD`; a static segment, like print).
  route("medications/print/week", "routes/app/groups/medications/print/week/route.tsx"),
];

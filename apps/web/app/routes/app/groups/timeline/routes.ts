import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The timeline and the sheets over it (children of `groups/:groupId`).
export const timelineRoutes: RouteConfigEntry[] = [
  route("timeline", "routes/app/groups/timeline/route.tsx", [
    // Sheets over the timeline, which stays mounted underneath.
    route("new/:kind", "routes/app/groups/timeline/new/route.tsx"),
    route(":entryId/edit", "routes/app/groups/timeline/edit/route.tsx"),
    // The Dose sheet (a static segment, so it wins over `new/:kind`).
    route("new/dose", "routes/app/groups/timeline/new-dose/route.tsx"),
    // The pass sheet: one pass log's doses.
    route("pass/:passLogId/edit", "routes/app/groups/timeline/pass/route.tsx"),
  ]),
];

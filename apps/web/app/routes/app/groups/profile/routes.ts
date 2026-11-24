import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// The care recipient's profile (not a section), with its edit sheets over it.
export const profileRoutes: RouteConfigEntry[] = [
  route("profile", "routes/app/groups/profile/route.tsx", [
    route("basics", "routes/app/groups/profile/basics/route.tsx"),
    route("contact", "routes/app/groups/profile/contact/route.tsx"),
    route("insurance", "routes/app/groups/profile/insurance/route.tsx"),
    route("emergency", "routes/app/groups/profile/emergency/route.tsx"),
    // The recipient's allergies (fixes-ui slice 34; they were a medications sheet).
    route("allergies", "routes/app/groups/profile/allergies/route.tsx"),
    // The recipient's conditions (conditions).
    route("conditions/new", "routes/app/groups/profile/conditions/new/route.tsx"),
    route("conditions/:conditionId", "routes/app/groups/profile/conditions/view/route.tsx"),
    route("conditions/:conditionId/edit", "routes/app/groups/profile/conditions/edit/route.tsx"),
  ]),
  // The printable emergency sheet: a page of its own, not a sheet over the profile.
  route("profile/print", "routes/app/groups/profile/print/route.tsx"),
];

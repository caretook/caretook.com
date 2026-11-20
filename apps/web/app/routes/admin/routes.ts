import { type RouteConfigEntry, layout, route } from "@react-router/dev/routes";

// Caretook staff only (admin and support; web only): accounts, groups, access
// codes, staff-made groups, the waitlist, the audit log and settings.
export const adminRoutes: RouteConfigEntry[] = [
  layout("routes/admin/layout/route.tsx", { id: "admin" }, [
    route("admin", "routes/admin/index/route.tsx"),
    route("admin/access-codes", "routes/admin/access-codes/route.tsx"),
    route("admin/new-group", "routes/admin/new-group/route.tsx"),
    route("admin/waitlist", "routes/admin/waitlist/route.tsx"),
    route("admin/audit", "routes/admin/audit/route.tsx"),
    route("admin/users", "routes/admin/users/route.tsx"),
    route("admin/users/:userId", "routes/admin/user/route.tsx"),
    route("admin/groups", "routes/admin/groups/route.tsx"),
    route("admin/groups/:groupId", "routes/admin/group/route.tsx"),
    route("admin/settings", "routes/admin/settings/route.tsx"),
    route("admin/suppressions", "routes/admin/suppressions/route.tsx"),
  ]),
  route("admin/access-codes/:id/print", "routes/admin/access-codes-print/route.tsx"),
  route("admin/waitlist/export", "routes/admin/waitlist-export/route.ts"),
];

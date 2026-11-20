import type { GroupRoleName } from "../../../constants/roles";

// Care groups in /admin (admin slice 4). Pure and client-safe: the API, the
// service and the group page share it.

/** Groups per page on /admin/groups. */
export const GROUP_ADMIN_PAGE_SIZE = 50;

/** Roles staff set through Change role (making an owner is its own action, Make owner). */
export const STAFF_SETTABLE_GROUP_ROLES = [
  "admin",
  "caretaker",
  "viewer",
] as const satisfies readonly GroupRoleName[];
export type StaffSettableGroupRole = (typeof STAFF_SETTABLE_GROUP_ROLES)[number];

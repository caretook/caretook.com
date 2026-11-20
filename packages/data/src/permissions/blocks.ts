import type { GroupRoleName } from "../constants/roles";
import type { DbSchemaName } from "../db/types";
import type { PermissionEntry, PermissionRoleName } from "./types";

import { GROUP_MANAGER_ROLES, GROUP_ROLE_NAMES } from "../constants/roles";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

export const NO_ACCESS = {
  admin: ["none"],
  support: ["none"],
  member: ["none"],
  system: ["none"],
  unauthenticated: ["none"],
} as const satisfies PermissionEntry<DbSchemaName>;

/** Admins and the system can touch every row; members (and support) only their own. */
export const DEFAULT_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  support: ["owned"],
  member: ["owned"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/** Only admins and the system. */
export const ADMIN_ONLY_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/**
 * Caretook staff (admin and support) and the system: what both staff roles
 * read, and the staff writes support may make too (access codes). What each
 * role may do in /admin is decided by db/schema/staffRules.ts, checked
 * before any service runs.
 */
export const STAFF_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  support: ["all"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/** Nobody, the system included: append-only and permanent rows. */
export const NOBODY_ENTRY = NO_ACCESS satisfies PermissionEntry<DbSchemaName>;

/** Any signed-in user, plus the system. */
export const SIGNED_IN_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  support: ["all"],
  member: ["all"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/**
 * Members of the row's care group with one of `roles`, plus the system.
 * Global roles add nothing: staff only see care data in groups they belong to.
 */
export const groupEntry = (roles: readonly GroupRoleName[]) =>
  ({ ...NO_ACCESS, system: ["all"], group: roles }) as const satisfies PermissionEntry<DbSchemaName>;

/** Admins and the system: support may not change roles or emails. */
export const STAFF_ONLY: readonly PermissionRoleName[] = ["admin", "system"];
/** Set by services running as SYSTEM_USER, or not at all. */
export const SYSTEM_ONLY: readonly PermissionRoleName[] = ["system"];

export const ANY_GROUP_ROLE = GROUP_ROLE_NAMES;
export const MANAGERS = GROUP_MANAGER_ROLES;
export const OWNERS: readonly GroupRoleName[] = ["owner"];
export const WRITERS: readonly GroupRoleName[] = ["owner", "admin", "caretaker"];

/** What a co-member may read of another member's `user` row. */
export const PUBLIC_PROFILE_FIELDS = ["id", "name", "image"] as const;

export const SYSTEM_ONLY_ENTRY = {
  ...NO_ACCESS,
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

export const SYSTEM_ONLY_SCHEMA = {
  create: SYSTEM_ONLY_ENTRY,
  read: SYSTEM_ONLY_ENTRY,
  list: SYSTEM_ONLY_ENTRY,
  update: SYSTEM_ONLY_ENTRY,
  delete: SYSTEM_ONLY_ENTRY,
} as const;

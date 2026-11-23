import type { GroupRoleName } from "../constants/roles";
import type { DbSchemaName } from "../db/types";
import type { PermissionEntry, PermissionRoleName } from "./types";

import {
  EASY_ROLE_NAMES,
  GROUP_MANAGER_ROLES,
  GROUP_ROLE_NAMES,
  LOGGER_ROLES,
  OWNER_ROLES,
  WRITER_ROLES,
} from "../constants/roles";

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

/**
 * `groupEntry(roles)`, plus `ownRoles` on the rows they created only
 * (`groupOwn`: the row's `created_by` is the actor).
 */
export const groupOwnEntry = (roles: readonly GroupRoleName[], ownRoles: readonly GroupRoleName[]) =>
  ({
    ...NO_ACCESS,
    system: ["all"],
    group: roles,
    groupOwn: ownRoles,
  }) as const satisfies PermissionEntry<DbSchemaName>;

/** Admins and the system: support may not change roles or emails. */
export const STAFF_ONLY: readonly PermissionRoleName[] = ["admin", "system"];
/** Set by services running as SYSTEM_USER, or not at all. */
export const SYSTEM_ONLY: readonly PermissionRoleName[] = ["system"];

// The role sets, from constants/roles.ts (the one source; see there).
export const ANY_GROUP_ROLE: readonly GroupRoleName[] = GROUP_ROLE_NAMES;
export const MANAGERS: readonly GroupRoleName[] = GROUP_MANAGER_ROLES;
export const OWNERS: readonly GroupRoleName[] = OWNER_ROLES;
/** May change setup and anyone's data. */
export const WRITERS: readonly GroupRoleName[] = WRITER_ROLES;
/** May log care: the writers, and an Easy helper (on their own entries: `groupOwn`). */
export const LOGGERS: readonly GroupRoleName[] = LOGGER_ROLES;
/** The roles that always get the easy view. */
export const EASY_ROLES: readonly GroupRoleName[] = EASY_ROLE_NAMES;
/** Loggers who aren't writers (an Easy helper): they change only the rows they created. */
export const OWN_ROW_LOGGERS: readonly GroupRoleName[] = LOGGERS.filter((role) => !WRITERS.includes(role));

/** What a co-member may read of another member's `user` row. */
export const PUBLIC_PROFILE_FIELDS = ["id", "name", "image", "avatarColor", "avatarIcon"] as const;

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

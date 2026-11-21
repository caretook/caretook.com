import type { DbSchemaName } from "../db/types";
import type { AppError } from "../errors";
import type {
  AuthUser,
  PermissionRoleName,
  PermissionScope,
  Permissions,
  RolePermission,
  SchemaPermission,
  ScopeRule,
} from "./types";

import { USER_ROLE_NAMES } from "../constants/roles";
import { isError, newError } from "../errors";
import { ADMIN_PERMISSIONS } from "./admin";
import { APPOINTMENTS_PERMISSIONS } from "./appointments";
import { AUTH_PERMISSIONS } from "./auth";
import { CALENDARS_PERMISSIONS } from "./calendars";
import { CARE_GROUPS_PERMISSIONS } from "./care-groups";
import { CARE_PERIODS_PERMISSIONS } from "./care-periods";
import { CONNECTORS_PERMISSIONS } from "./connectors";
import { CORE_PERMISSIONS } from "./core";
import { LIVE_NOTES_PERMISSIONS } from "./live-notes";
import { MARKETING_PERMISSIONS } from "./marketing";
import { MEDICATIONS_PERMISSIONS } from "./medications";
import { NOTIFICATIONS_PERMISSIONS } from "./notifications";
import { PROFILES_PERMISSIONS } from "./profiles";
import { PROVIDERS_PERMISSIONS } from "./providers";
import { TASKS_PERMISSIONS } from "./tasks";
import { TIMELINE_PERMISSIONS } from "./timeline";

// The building blocks live in blocks.ts, and the tables' permissions in one part per
// area (`./<area>.ts`). A new table's entry goes in its area's part.

export {
  ADMIN_ONLY_PERMISSION_ENTRY,
  DEFAULT_PERMISSION_ENTRY,
  PUBLIC_PROFILE_FIELDS,
  STAFF_PERMISSION_ENTRY,
} from "./blocks";

// ---------------------------------------------------------------------------
// The permission map. Every table must have an entry (enforced by the type).
// ---------------------------------------------------------------------------

export const PERMISSIONS: Permissions = {
  ...ADMIN_PERMISSIONS,
  ...APPOINTMENTS_PERMISSIONS,
  ...AUTH_PERMISSIONS,
  ...CALENDARS_PERMISSIONS,
  ...CARE_GROUPS_PERMISSIONS,
  ...CARE_PERIODS_PERMISSIONS,
  ...CONNECTORS_PERMISSIONS,
  ...CORE_PERMISSIONS,
  ...LIVE_NOTES_PERMISSIONS,
  ...MARKETING_PERMISSIONS,
  ...MEDICATIONS_PERMISSIONS,
  ...NOTIFICATIONS_PERMISSIONS,
  ...PROFILES_PERMISSIONS,
  ...PROVIDERS_PERMISSIONS,
  ...TASKS_PERMISSIONS,
  ...TIMELINE_PERMISSIONS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const getRoleNames = (authUser: AuthUser | null): readonly PermissionRoleName[] =>
  authUser?.roleNames.length ? authUser.roleNames : ["unauthenticated"];

export type GetPermissionsByRolesArgs = {
  roles: readonly PermissionRoleName[];
  schemaName: DbSchemaName;
  permission: SchemaPermission;
};

export const getPermissionsByRoles = ({
  roles,
  schemaName,
  permission,
}: GetPermissionsByRolesArgs): RolePermission[] => {
  const entry = PERMISSIONS[schemaName][permission];
  return roles.flatMap((role) => entry[role] ?? []);
};

/** A fresh error each call (the stack should point at the caller). */
export const rejectError = (authUser: AuthUser | null) =>
  newError({
    code: authUser ? "permissions:unauthorized" : "permissions:unauthenticated",
  });

/** The internal actor (SYSTEM_USER): bypasses service-level role rules too. */
export const isSystemUser = (authUser: AuthUser | null) => !!authUser?.roleNames.includes("system");

/** A real signed-in user (not the system actor, not anonymous). */
const isSignedInUser = (authUser: AuthUser | null): authUser is AuthUser =>
  !!authUser && authUser.roleNames.some((role) => USER_ROLE_NAMES.some((r) => r === role));

/**
 * Resolve what `authUser` may do with `permission` on `schemaName`.
 *
 * "all" from any global role wins outright. Otherwise the scope is the OR of
 * every rule that applies: `owned` from a global role, plus `group` rules
 * from the entry's group roles. No rules means no access.
 */
export const getPermissionScope = (
  schemaName: DbSchemaName,
  permission: SchemaPermission,
  authUser: AuthUser | null,
): PermissionScope | AppError => {
  const permissions = getPermissionsByRoles({
    roles: getRoleNames(authUser),
    schemaName,
    permission,
  });

  if (permissions.includes("all")) return { type: "all" };

  const schemaEntry = PERMISSIONS[schemaName];
  const { ownerField, groupField, groupUserField } = schemaEntry as {
    ownerField?: string;
    groupField?: string;
    groupUserField?: string;
  };
  const rules: ScopeRule[] = [];

  if (permissions.includes("owned") && authUser && ownerField) {
    rules.push({ type: "owned", field: ownerField, userId: authUser.id });
  }

  const groupRoles = schemaEntry[permission].group;
  const groupFields = schemaEntry[permission].groupFields as readonly string[] | undefined;
  const limit = groupFields ? { fields: groupFields } : {};
  if (groupRoles?.length && isSignedInUser(authUser)) {
    // A misconfigured entry must fail loudly, never silently widen or drop access.
    if (!groupField && !groupUserField) {
      throw new Error(`${schemaName}.${permission} has group roles but no groupField or groupUserField`);
    }
    if (groupField)
      rules.push({ type: "group", field: groupField, userId: authUser.id, groupRoles, ...limit });
    if (groupUserField) {
      rules.push({ type: "groupUser", field: groupUserField, userId: authUser.id, groupRoles, ...limit });
    }
  }

  return rules.length ? { type: "rules", rules } : rejectError(authUser);
};

/** Fields in `data` that `authUser` isn't allowed to set for this permission. */
export const getUnauthorizedFields = ({
  schemaName,
  permission,
  authUser,
  data,
}: {
  schemaName: DbSchemaName;
  permission: SchemaPermission;
  authUser: AuthUser | null;
  data: Record<string, unknown>;
}): string[] => {
  const fields = PERMISSIONS[schemaName][permission].fields as
    Record<string, readonly PermissionRoleName[] | undefined> | undefined;
  if (!fields) return [];

  const roles = getRoleNames(authUser);
  return Object.keys(data).filter((key) => {
    const allowed = fields[key];
    if (!allowed || data[key] === undefined) return false;
    return !allowed.some((role) => roles.includes(role));
  });
};

export type HasPermissionArgs = {
  authUser: AuthUser | null;
  schemaName: DbSchemaName;
  permission: SchemaPermission;
  /** The row being acted on. Required to decide `owned` and `group` permissions. */
  target?: Record<string, unknown>;
};

/**
 * Boolean check for UI and business logic (e.g. "show the edit button").
 * The model layer enforces the same rules in SQL; this never replaces that.
 *
 * `group` rules are decided from `authUser.groupRoles`. Without it, or for
 * `groupUser` rules (which depend on other users' memberships), they're false.
 */
export const hasPermission = ({ authUser, schemaName, permission, target }: HasPermissionArgs) => {
  const scope = getPermissionScope(schemaName, permission, authUser);
  if (isError(scope)) return false;
  if (scope.type === "all") return true;
  if (!target) return false;

  return scope.rules.some((rule) => {
    const value = target[rule.field];
    switch (rule.type) {
      case "owned":
        return value === rule.userId;
      case "group": {
        const role = typeof value === "string" ? authUser?.groupRoles?.[value] : undefined;
        return !!role && rule.groupRoles.includes(role);
      }
      case "groupUser":
        return false;
    }
  });
};

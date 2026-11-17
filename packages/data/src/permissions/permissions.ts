import type { DbSchemaName } from "../db/types";
import type { AppError } from "../errors";
import type {
  AuthUser,
  PermissionEntry,
  PermissionRoleName,
  PermissionScope,
  Permissions,
  RolePermission,
  SchemaPermission,
} from "./types";

import { isError, newError } from "../errors";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const NO_ACCESS = {
  admin: ["none"],
  member: ["none"],
  system: ["none"],
  unauthenticated: ["none"],
} as const satisfies PermissionEntry<DbSchemaName>;

/** Admins and the system can touch every row; members only their own. */
export const DEFAULT_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  member: ["owned"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/** Only admins and the system. */
export const ADMIN_ONLY_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

const STAFF_ONLY: readonly PermissionRoleName[] = ["admin", "system"];

// ---------------------------------------------------------------------------
// The permission map. Every table must have an entry (enforced by the type).
// ---------------------------------------------------------------------------

export const PERMISSIONS: Permissions = {
  userSchema: {
    ownerField: "id",
    // Accounts are created by the auth flow (running as SYSTEM_USER) or by staff.
    create: ADMIN_ONLY_PERMISSION_ENTRY,
    // TODO: once care circles exist, members need to read other members of
    // their circles (a `circle` scope).
    read: DEFAULT_PERMISSION_ENTRY,
    list: DEFAULT_PERMISSION_ENTRY,
    update: {
      ...DEFAULT_PERMISSION_ENTRY,
      // Members can edit their profile but not escalate their role, and
      // email changes go through the auth provider's verification flow.
      fields: {
        role: STAFF_ONLY,
        email: STAFF_ONLY,
        emailVerified: STAFF_ONLY,
      },
    },
    // Members can delete their own account (a consumer-health-data requirement).
    delete: DEFAULT_PERMISSION_ENTRY,
  },
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

/**
 * Resolve what `authUser` may do with `permission` on `schemaName`.
 *
 * A user with several roles gets the most permissive scope any role grants
 * ("all" > "owned"); "none" only means that role adds nothing.
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

  const { ownerField } = PERMISSIONS[schemaName];
  if (permissions.includes("owned") && authUser && ownerField) {
    return { type: "owned", ownerField, ownerId: authUser.id };
  }

  return rejectError(authUser);
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
    | Record<string, readonly PermissionRoleName[] | undefined>
    | undefined;
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
  /** The row being acted on. Required to decide `owned` permissions. */
  target?: Record<string, unknown>;
};

/**
 * Boolean check for UI and business logic (e.g. "show the edit button").
 * The model layer enforces the same rules in SQL; this never replaces that.
 */
export const hasPermission = ({ authUser, schemaName, permission, target }: HasPermissionArgs) => {
  const scope = getPermissionScope(schemaName, permission, authUser);
  if (isError(scope)) return false;
  if (scope.type === "all") return true;
  return target?.[scope.ownerField] === scope.ownerId;
};

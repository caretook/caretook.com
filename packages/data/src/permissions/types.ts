import type { DbFieldKey, DbSchemaName } from "../db/types";
import type { UserRoleName } from "../constants/roles";

export type PermissionRoleName = UserRoleName | "system" | "unauthenticated";

export type SchemaPermission = "create" | "read" | "update" | "delete" | "list";

/**
 * How much of a table a role can act on for a given permission.
 * - all:   every row
 * - owned: rows whose `ownerField` equals the acting user's id
 * - none:  nothing
 *
 * Planned: `circle`, for rows belonging to a care circle the user is a member of.
 */
export type RolePermission = "all" | "owned" | "none";

/** The minimum the permission system needs to know about the acting user. */
export type AuthUser = {
  id: string;
  roleNames: readonly PermissionRoleName[];
};

/**
 * Field-level restrictions for write permissions. A field listed here may
 * only be set by the given roles; unlisted fields are allowed. An empty array
 * means nobody may set the field through the model layer.
 */
export type FieldPermissions<K extends DbSchemaName> = Partial<
  Record<DbFieldKey<K>, readonly PermissionRoleName[]>
>;

export type PermissionEntry<K extends DbSchemaName> = Readonly<
  Record<PermissionRoleName, readonly RolePermission[]>
> & {
  fields?: FieldPermissions<K>;
};

export type SchemaEntry<K extends DbSchemaName> = Readonly<
  Record<SchemaPermission, PermissionEntry<K>>
> & {
  /** Column holding the owning user's id; needed for `owned` permissions. */
  ownerField?: DbFieldKey<K>;
};

export type Permissions = { readonly [K in DbSchemaName]: SchemaEntry<K> };

/** The resolved scope for one request: what the WHERE clause must enforce. */
export type PermissionScope =
  | { type: "all" }
  | { type: "owned"; ownerField: string; ownerId: string };

import type { DbFieldKey, DbSchemaName } from "../db/types";
import type { GroupRoleName, UserRoleName } from "../constants/roles";

export type PermissionRoleName = UserRoleName | "system" | "unauthenticated";

export type SchemaPermission = "create" | "read" | "update" | "delete" | "list";

/**
 * How much of a table a global role can act on for a given permission.
 * - all:   every row
 * - owned: rows whose `ownerField` equals the acting user's id
 * - none:  nothing
 *
 * Care group access isn't a global role: see `group` on PermissionEntry.
 */
export type RolePermission = "all" | "owned" | "none";

/** The minimum the permission system needs to know about the acting user. */
export type AuthUser = {
  id: string;
  roleNames: readonly PermissionRoleName[];
  /**
   * The user's role in each care group they belong to (groupId → role).
   * Optional, and only used by `hasPermission` for UI checks. The model
   * layer never trusts it: SQL checks membership itself.
   */
  groupRoles?: Readonly<Record<string, GroupRoleName>>;
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
  /**
   * Care group roles that grant this permission, on rows of groups the actor
   * belongs to with one of these roles. Requires `groupField` or
   * `groupUserField` on the schema entry. Applies to any signed-in user
   * (global admins included, but only through their own memberships).
   */
  group?: readonly GroupRoleName[];
  /**
   * With `group`, on reads: the only columns a group-granted read returns.
   * A row the actor reaches only through `group` comes back with just these
   * fields; a row they also own, or reach through `all`, comes back whole.
   * The model enforces it in SQL (the other columns are never selected for
   * those rows, and a filter or order on them only matches whole rows).
   */
  groupFields?: readonly DbFieldKey<K>[];
};

export type SchemaEntry<K extends DbSchemaName> = Readonly<Record<SchemaPermission, PermissionEntry<K>>> & {
  /** Column holding the owning user's id; needed for `owned` permissions. */
  ownerField?: DbFieldKey<K>;
  /** Column holding the care group's id; enables `group` permissions. */
  groupField?: DbFieldKey<K>;
  /**
   * Column holding a user id. Enables `group` permissions on rows whose user
   * shares a care group with the actor (e.g. co-members' profiles).
   */
  groupUserField?: DbFieldKey<K>;
};

export type Permissions = { readonly [K in DbSchemaName]: SchemaEntry<K> };

/** One way a row can be in scope. A restricted scope ORs its rules. */
export type ScopeRule =
  | { type: "owned"; field: string; userId: string }
  /** `field` is a group the actor belongs to with one of `groupRoles`. */
  | {
      type: "group";
      field: string;
      userId: string;
      groupRoles: readonly GroupRoleName[];
      /** Rows matched only by this rule show just these fields (`groupFields`). */
      fields?: readonly string[];
    }
  /** `field` is a user who shares a group the actor belongs to with one of `groupRoles`. */
  | {
      type: "groupUser";
      field: string;
      userId: string;
      groupRoles: readonly GroupRoleName[];
      fields?: readonly string[];
    };

/** The resolved scope for one request: what the WHERE clause must enforce. */
export type PermissionScope = { type: "all" } | { type: "rules"; rules: readonly ScopeRule[] };

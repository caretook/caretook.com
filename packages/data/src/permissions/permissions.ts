import type { DbSchemaName } from "../db/types";
import type { AppError } from "../errors";
import type { GroupRoleName } from "../constants/roles";
import type {
  AuthUser,
  PermissionEntry,
  PermissionRoleName,
  PermissionScope,
  Permissions,
  RolePermission,
  SchemaPermission,
  ScopeRule,
} from "./types";

import { GROUP_MANAGER_ROLES, GROUP_ROLE_NAMES, USER_ROLE_NAMES } from "../constants/roles";
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

/** Any signed-in user, plus the system. */
const SIGNED_IN_PERMISSION_ENTRY = {
  ...NO_ACCESS,
  admin: ["all"],
  member: ["all"],
  system: ["all"],
} as const satisfies PermissionEntry<DbSchemaName>;

/**
 * Members of the row's care group with one of `roles`, plus the system.
 * Global roles add nothing: staff only see care data in groups they belong to.
 */
const groupEntry = (roles: readonly GroupRoleName[]) =>
  ({ ...NO_ACCESS, system: ["all"], group: roles }) as const satisfies PermissionEntry<DbSchemaName>;

const STAFF_ONLY: readonly PermissionRoleName[] = ["admin", "system"];
/** Set by services running as SYSTEM_USER, or not at all. */
const SYSTEM_ONLY: readonly PermissionRoleName[] = ["system"];

const ANY_GROUP_ROLE = GROUP_ROLE_NAMES;
const MANAGERS = GROUP_MANAGER_ROLES;
const OWNERS: readonly GroupRoleName[] = ["owner"];
const WRITERS: readonly GroupRoleName[] = ["owner", "admin", "caretaker"];

const SYSTEM_ONLY_ENTRY = { ...NO_ACCESS, system: ["all"] } as const satisfies PermissionEntry<DbSchemaName>;

const SYSTEM_ONLY_SCHEMA = {
  create: SYSTEM_ONLY_ENTRY,
  read: SYSTEM_ONLY_ENTRY,
  list: SYSTEM_ONLY_ENTRY,
  update: SYSTEM_ONLY_ENTRY,
  delete: SYSTEM_ONLY_ENTRY,
} as const;

// ---------------------------------------------------------------------------
// The permission map. Every table must have an entry (enforced by the type).
// ---------------------------------------------------------------------------

export const PERMISSIONS: Permissions = {
  userSchema: {
    ownerField: "id",
    // Co-members of a care group can read each other (name, image, email).
    groupUserField: "id",
    // Accounts are created by the auth flow (running as SYSTEM_USER) or by staff.
    create: ADMIN_ONLY_PERMISSION_ENTRY,
    read: { ...DEFAULT_PERMISSION_ENTRY, group: ANY_GROUP_ROLE },
    list: { ...DEFAULT_PERMISSION_ENTRY, group: ANY_GROUP_ROLE },
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

  careGroupSchema: {
    groupField: "id",
    // Anyone signed in can start a group. Use careGroupService.create, which
    // makes the creator its first owner in the same transaction.
    create: SIGNED_IN_PERMISSION_ENTRY,
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    update: groupEntry(MANAGERS),
    delete: groupEntry(OWNERS),
  },

  // Role rules the map can't express (only owners touch owners, a group
  // always keeps an owner) live in careGroupMemberService. Write through it.
  careGroupMemberSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(MANAGERS), fields: { invitedBy: SYSTEM_ONLY } },
    update: {
      ...groupEntry(MANAGERS),
      // A membership can change role, never group or user.
      fields: { groupId: SYSTEM_ONLY, userId: SYSTEM_ONLY, invitedBy: SYSTEM_ONLY },
    },
    // Managers remove members; anyone can remove themselves (leave).
    delete: { ...groupEntry(MANAGERS), admin: ["owned"], member: ["owned"] },
  },

  careRecipientSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(MANAGERS),
    update: { ...groupEntry(WRITERS), fields: { groupId: SYSTEM_ONLY } },
    delete: groupEntry(MANAGERS),
  },

  // Invites carry the invitee's email, so only managers see them. The
  // invitee reads theirs by token through the service (as SYSTEM_USER).
  careGroupInviteSchema: {
    groupField: "groupId",
    read: groupEntry(MANAGERS),
    list: groupEntry(MANAGERS),
    create: {
      ...groupEntry(MANAGERS),
      fields: {
        status: SYSTEM_ONLY,
        acceptedBy: SYSTEM_ONLY,
        respondedAt: SYSTEM_ONLY,
        useCount: SYSTEM_ONLY,
      },
    },
    update: {
      ...groupEntry(MANAGERS),
      // Managers may only revoke (status); everything else is fixed.
      fields: {
        groupId: SYSTEM_ONLY,
        email: SYSTEM_ONLY,
        role: SYSTEM_ONLY,
        tokenHash: SYSTEM_ONLY,
        expiresAt: SYSTEM_ONLY,
        acceptedBy: SYSTEM_ONLY,
        respondedAt: SYSTEM_ONLY,
        kind: SYSTEM_ONLY,
        maxUses: SYSTEM_ONLY,
        useCount: SYSTEM_ONLY,
        consentAttestedBy: SYSTEM_ONLY,
        consentAttestedAt: SYSTEM_ONLY,
        consentVersion: SYSTEM_ONLY,
        tokenCiphertext: SYSTEM_ONLY,
      },
    },
    delete: groupEntry(MANAGERS),
  },

  // Better Auth's tables: it uses them through its own adapter, never our
  // models, so only the system may touch them here.
  sessionSchema: SYSTEM_ONLY_SCHEMA,
  accountSchema: SYSTEM_ONLY_SCHEMA,
  verificationSchema: SYSTEM_ONLY_SCHEMA,
  jwksSchema: SYSTEM_ONLY_SCHEMA,

  // Any writer may edit or delete any entry (not just their own). Deletes
  // are soft (timelineEntryModel.remove sets deletedAt under this delete
  // permission); hard deletes are system-only (purge).
  timelineEntrySchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupEntry(WRITERS),
      fields: { groupId: SYSTEM_ONLY, recipientId: SYSTEM_ONLY, kind: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY },
    },
    delete: groupEntry(WRITERS),
  },

  // Live documents on note and event entries. Writers add one (through
  // noteDocumentService, which checks the entry); the snapshot, text and editors are
  // written by compaction, as the system. Removing the entry hides it.
  noteDocumentSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: {
      ...groupEntry(WRITERS),
      fields: { snapshot: SYSTEM_ONLY, text: SYSTEM_ONLY, editors: SYSTEM_ONLY },
    },
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Append-only edits: writers add them, everyone in the group reads them
  // (viewers watch live). Only compaction (the system) deletes them.
  noteUpdateSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // The group's provider directory. Any writer adds, edits and deletes any
  // provider; deletes are soft (providerModel.remove sets deletedAt under
  // this delete permission), so linked entries keep the name. Write through
  // providerService, which checks the practice.
  providerSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: { ...groupEntry(WRITERS), fields: { groupId: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY } },
    delete: groupEntry(WRITERS),
  },

  // Which providers an event or note was with. Writers link and unlink
  // (a hard delete); a link never changes, so update is the system's.
  // Write through entryProviderService, which checks both ends.
  timelineEntryProviderSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: groupEntry(WRITERS),
  },

  // @caretook/notifications' outbox and the dev mailbox: the system's only.
  notificationOutboxSchema: SYSTEM_ONLY_SCHEMA,
  devMailSchema: SYSTEM_ONLY_SCHEMA,

  // Who agreed to what a group shares, and when. Written only by the system
  // (careGroupInviteService.accept); read by the group's owners and admins,
  // and by the member themselves.
  careGroupConsentSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: { ...groupEntry(MANAGERS), admin: ["owned"], member: ["owned"] },
    list: { ...groupEntry(MANAGERS), admin: ["owned"], member: ["owned"] },
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Requests to join from an invite link. Read by the group's owners and
  // admins, and by the requester themselves; written only by the system
  // (joinRequestService, careGroupInviteService.accept).
  careGroupJoinRequestSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: { ...groupEntry(MANAGERS), admin: ["owned"], member: ["owned"] },
    list: { ...groupEntry(MANAGERS), admin: ["owned"], member: ["owned"] },
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Access codes (staff-made tickets for starting a group) and who used
  // them: Caretook staff (global admin) only. Redeeming a code runs as the
  // system, inside sign-up (accessCodeService.redeem).
  accessCodeSchema: {
    create: ADMIN_ONLY_PERMISSION_ENTRY,
    read: ADMIN_ONLY_PERMISSION_ENTRY,
    list: ADMIN_ONLY_PERMISSION_ENTRY,
    update: { ...ADMIN_ONLY_PERMISSION_ENTRY, fields: { code: SYSTEM_ONLY, useCount: SYSTEM_ONLY } },
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
  },
  accessCodeRedemptionSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: ADMIN_ONLY_PERMISSION_ENTRY,
    list: ADMIN_ONLY_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // The marketing site's waitlist and contact messages: what visitors typed
  // into the public forms. Written only by the system (waitlistService.join,
  // contactMessageService.send); read, and removed on request, by staff.
  waitlistEntrySchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: ADMIN_ONLY_PERMISSION_ENTRY,
    list: ADMIN_ONLY_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
  },
  contactMessageSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: ADMIN_ONLY_PERMISSION_ENTRY,
    list: ADMIN_ONLY_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
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
  if (groupRoles?.length && isSignedInUser(authUser)) {
    // A misconfigured entry must fail loudly, never silently widen or drop access.
    if (!groupField && !groupUserField) {
      throw new Error(`${schemaName}.${permission} has group roles but no groupField or groupUserField`);
    }
    if (groupField) rules.push({ type: "group", field: groupField, userId: authUser.id, groupRoles });
    if (groupUserField) {
      rules.push({ type: "groupUser", field: groupUserField, userId: authUser.id, groupRoles });
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

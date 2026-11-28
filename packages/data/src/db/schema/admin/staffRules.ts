import { z } from "zod";

// What Caretook staff may do in /admin (admin PRD). Pure and client-safe: the
// API's `staffProcedure`, the services, `requireStaff` and the app's account
// menu all ask this module, and it's the only one that knows what the two
// staff roles (`admin`, `support`) are allowed. Neither grants any care data:
// group data is still decided by group membership alone (see PERMISSIONS).

/** The global roles that count as staff. */
export const STAFF_ROLE_NAMES = ["admin", "support"] as const;
export type StaffRoleName = (typeof STAFF_ROLE_NAMES)[number];

/** Roles staff can give an account through /admin and `pnpm admin:grant` (`member` removes staff access). */
export const ASSIGNABLE_ROLE_NAMES = ["admin", "support", "member"] as const;
export type AssignableRoleName = (typeof ASSIGNABLE_ROLE_NAMES)[number];

const BOTH = ["admin", "support"] as const satisfies readonly StaffRoleName[];
const ADMIN = ["admin"] as const satisfies readonly StaffRoleName[];

/** Each staff capability and the roles that have it. */
export const STAFF_CAPABILITIES = {
  /** Search accounts and open an account's page. */
  "users.read": BOTH,
  /** Resend verification, send a password reset, sign sessions out. */
  "users.help": BOTH,
  /** Disable and re-enable accounts. */
  "users.disable": ADMIN,
  /** Make someone support or admin, or remove their staff role. */
  "users.setRole": ADMIN,
  /** Raise, lower or reset one account's care group limit (free-limits PRD). */
  "users.limits": BOTH,
  /** Search care groups and open a group's page (never its care data). */
  "groups.read": BOTH,
  /** Owner recovery, role changes and removals in a group. */
  "groups.manage": ADMIN,
  /** Create and revoke access codes. */
  "accessCodes.write": BOTH,
  /** Set up a group with an owner invite. */
  "staffGroups.create": BOTH,
  /** Read and export the waitlist. */
  "waitlist.read": BOTH,
  /** Read the audit log. */
  "audit.read": BOTH,
  /** Read the app settings. */
  "settings.read": BOTH,
  /** Change the app settings. */
  "settings.write": ADMIN,
} as const satisfies Record<string, readonly StaffRoleName[]>;

export type StaffCapability = keyof typeof STAFF_CAPABILITIES;
export const STAFF_CAPABILITY_NAMES = Object.keys(STAFF_CAPABILITIES) as StaffCapability[];

const isStaffRoleName = (role: string): role is StaffRoleName => STAFF_ROLE_NAMES.some((r) => r === role);

/** Whether any of `roleNames` (an AuthUser's, or a session user's role) is a staff role. */
export const isStaff = (roleNames: readonly string[] | null | undefined) =>
  !!roleNames?.some(isStaffRoleName);

/** Whether `roleNames` grant `capability`. */
export const staffCan = (roleNames: readonly string[] | null | undefined, capability: StaffCapability) => {
  const allowed: readonly string[] = STAFF_CAPABILITIES[capability];
  return !!roleNames?.some((role) => allowed.includes(role));
};

/** Every capability `roleNames` grant, in the table's order (what pages use to hide controls). */
export const staffCapabilities = (roleNames: readonly string[] | null | undefined) =>
  STAFF_CAPABILITY_NAMES.filter((capability) => staffCan(roleNames, capability));

export type StaffRefusal = "self" | "lastAdmin" | "unknownRole" | "unchanged";

/**
 * Why a staff role change is refused, or null when it may go ahead. Nobody
 * changes their own role, the last admin is never demoted, and only
 * `ASSIGNABLE_ROLE_NAMES` may be given. `adminCount` counts current admins,
 * the target included.
 */
export const roleChangeRefusal = ({
  actorId,
  targetId,
  from,
  to,
  adminCount,
}: {
  actorId: string | null;
  targetId: string;
  from: string;
  to: string;
  adminCount: number;
}): StaffRefusal | null => {
  if (!ASSIGNABLE_ROLE_NAMES.some((r) => r === to)) return "unknownRole";
  if (actorId !== null && actorId === targetId) return "self";
  if (from === to) return "unchanged";
  if (from === "admin" && adminCount <= 1) return "lastAdmin";
  return null;
};

/**
 * Why disabling an account is refused, or null when it may go ahead: not
 * yourself, and never the last admin. `adminCount` counts current (enabled)
 * admins, the target included.
 */
export const disableRefusal = ({
  actorId,
  targetId,
  targetRole,
  adminCount,
}: {
  actorId: string | null;
  targetId: string;
  targetRole: string;
  adminCount: number;
}): StaffRefusal | null => {
  if (actorId !== null && actorId === targetId) return "self";
  if (targetRole === "admin" && adminCount <= 1) return "lastAdmin";
  return null;
};

/** What staff are told when a guard refuses. */
export const STAFF_REFUSAL_MESSAGES: Record<StaffRefusal, string> = {
  self: "You can't do that to your own account.",
  lastAdmin: "There must always be at least one admin.",
  unknownRole: "That isn't a staff role.",
  unchanged: "They already have that role.",
};

/** The longest reason staff can give for a change. */
export const STAFF_REASON_MAX = 500;

/** The reason every changing staff action takes (1–500 characters, trimmed). */
export const staffReasonZSchema = z
  .string()
  .trim()
  .min(1, "Say why")
  .max(STAFF_REASON_MAX, `At most ${STAFF_REASON_MAX} characters`);

import type { AuthUser } from "@caretook/data/permissions";
import type { ActionResult } from "~/lib/api";

import { hasPermission } from "@caretook/data/permissions";
import { careGroupInsertZSchema, careRecipientProfileZSchema } from "@caretook/data/schema";

// The pure parts of group settings (`./route.tsx`): who may
// edit what, and turning a submitted form into a valid change or field errors.

/** What every save says when the request can't reach the server. */
export const NEEDS_CONNECTION = "Needs a connection to edit.";

/**
 * Which parts of group settings a member with `role` may edit, by the same
 * permission map the server enforces (the server stays the authority).
 */
export const groupSettingsAccess = (groupId: string, role: string | null) => {
  const authUser: AuthUser = {
    id: "",
    roleNames: ["member"],
    groupRoles: role ? { [groupId]: role as GroupRoles[string] } : {},
  };
  return {
    renameGroup: hasPermission({
      authUser,
      schemaName: "careGroupSchema",
      permission: "update",
      target: { id: groupId },
    }),
    editRecipient: hasPermission({
      authUser,
      schemaName: "careRecipientSchema",
      permission: "update",
      target: { groupId },
    }),
  };
};

type GroupRoles = NonNullable<AuthUser["groupRoles"]>;

type Failure = Extract<ActionResult, { ok: false }>;
type Parsed<T> = { ok: true; data: T } | Failure;

const TOO_LONG = "Use 120 characters or fewer.";

/** What each field's error says (the schemas' own messages aren't written for people). */
const fieldMessage = (field: string, value: string) => {
  if (field === "name") return value.trim() ? TOO_LONG : "Enter a name.";
  if (field === "timeZone") return "Choose a time zone from the list.";
  return TOO_LONG;
};

const failure = (
  issues: { path: PropertyKey[] }[],
  values: Record<string, string>,
  error: string,
): Failure => {
  const fields = [...new Set(issues.map((issue) => String(issue.path[0] ?? "")))];
  return {
    ok: false,
    error,
    issues: fields.map((path) => ({ path, message: fieldMessage(path, values[path] ?? "") })),
  };
};

/** A submitted group name: trimmed, or the name field's error. */
export const parseGroupName = (values: { name: string }): Parsed<{ name: string }> => {
  const parsed = careGroupInsertZSchema.pick({ name: true }).safeParse(values);
  if (parsed.success) return { ok: true, data: parsed.data };
  return failure(parsed.error.issues, values, "Check the care group's name.");
};

/**
 * A submitted recipient time zone (group settings Details; the rest of the
 * recipient is edited on their profile). An empty zone keeps the stored one;
 * a zone the runtime doesn't know is a field error.
 */
export const parseRecipientTimeZone = (values: { timeZone: string }): Parsed<{ timeZone?: string }> => {
  const timeZone = values.timeZone.trim();
  if (!timeZone) return { ok: true, data: {} };
  const parsed = careRecipientProfileZSchema.pick({ timeZone: true }).safeParse({ timeZone });
  if (!parsed.success) return failure(parsed.error.issues, values, "Check the care recipient's time zone.");
  return { ok: true, data: parsed.data.timeZone ? { timeZone: parsed.data.timeZone } : {} };
};

// ---------------------------------------------------------------------------
// Time zone
// ---------------------------------------------------------------------------

/** An IANA zone as people read it: "America/Los_Angeles" → "America/Los Angeles". */
export const timeZoneLabel = (zone: string) => zone.replaceAll("_", " ");

/**
 * The zones the time zone field offers: every zone the runtime supports,
 * sorted, plus `current` and `device` when the runtime's list leaves them out
 * ("UTC" often isn't in it). `supported` is for tests.
 */
export const timeZoneOptions = (
  current: string | null,
  device: string,
  supported: readonly string[] = supportedTimeZones(),
): string[] => {
  const zones = new Set(supported);
  if (current) zones.add(current);
  if (device) zones.add(device);
  return [...zones].sort((a, b) => a.localeCompare(b));
};

const supportedTimeZones = (): readonly string[] => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/** Group roles, highest first: the order of the members list and of a role menu. */
export const MEMBER_ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  caretaker: "Caretaker",
  viewer: "Viewer",
};

const isMemberRole = (role: string | null): role is MemberRole =>
  MEMBER_ROLES.some((known) => known === role);

/** A role's name for people. A role this build doesn't know shows as it is. */
export const roleLabel = (role: string | null) => (isMemberRole(role) ? ROLE_LABELS[role] : role || "Member");

/**
 * What the signed-in member may do to one member of the group, by the rules
 * the server enforces (it stays the authority):
 * - `roles`: the roles they may give this member, with the current one (empty:
 *   show the role as text). Owners and admins change roles; only an owner
 *   gives or takes the owner role.
 * - `remove`: owners and admins remove others; only an owner removes an owner.
 * - `leave`: anyone may leave. (The last owner is refused by the server, with
 *   a message saying why, as is the last owner's own demotion.)
 */
export const memberAccess = ({
  actorRole,
  memberRole,
  isSelf,
}: {
  actorRole: string | null;
  memberRole: string | null;
  isSelf: boolean;
}): { roles: MemberRole[]; remove: boolean; leave: boolean } => {
  const owner = actorRole === "owner";
  const manages = (owner || actorRole === "admin") && (owner || memberRole !== "owner");
  return {
    roles: manages ? MEMBER_ROLES.filter((role) => owner || role !== "owner") : [],
    remove: manages && !isSelf,
    leave: isSelf,
  };
};

/** Members by role (owners first), then by name; members without a name go last in their role. */
export const sortMembers = <T extends { role: string | null; name: string | null }>(members: T[]): T[] => {
  const rank = (role: string | null) => {
    const at = MEMBER_ROLES.findIndex((known) => known === role);
    return at < 0 ? MEMBER_ROLES.length : at;
  };
  return [...members].sort(
    (a, b) =>
      rank(a.role) - rank(b.role) ||
      Number(!a.name) - Number(!b.name) ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );
};

/** What a member is called on the page: their name, or "Member" until their profile has synced. */
export const memberName = (name: string | null) => name?.trim() || "Member";

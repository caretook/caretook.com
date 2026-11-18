import type { AuthUser } from "@caretook/data/permissions";
import type { CareRecipientProfileInput } from "@caretook/data/schema";
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
  if (field === "dateOfBirth") return "Enter a valid date.";
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
 * A submitted recipient profile. An empty preferred name or date of birth
 * clears it; an empty name, or a date that isn't one, is a field error.
 */
export const parseRecipientProfile = (values: {
  name: string;
  preferredName: string;
  dateOfBirth: string;
}): Parsed<Required<CareRecipientProfileInput>> => {
  const parsed = careRecipientProfileZSchema.safeParse({
    name: values.name,
    preferredName: values.preferredName.trim() || null,
    dateOfBirth: values.dateOfBirth.trim() || null,
  });
  if (!parsed.success) return failure(parsed.error.issues, values, "Check the care recipient's details.");
  const { name = "", preferredName = null, dateOfBirth = null } = parsed.data;
  return { ok: true, data: { name, preferredName, dateOfBirth } };
};

/** A stored date of birth (`1941-03-09`) as a long date, in no particular time zone. */
export const formatDateOfBirth = (value: string, locale?: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { timeZone: "UTC", dateStyle: "long" });
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

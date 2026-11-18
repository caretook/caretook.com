import type { AuthUser } from "@caretook/data/permissions";
import type { CareRecipientProfileInput } from "@caretook/data/schema";
import type { ActionResult } from "./api";

import { hasPermission } from "@caretook/data/permissions";
import { careGroupInsertZSchema, careRecipientProfileZSchema } from "@caretook/data/schema";

// The pure parts of group settings (`routes/app/groupSettings.tsx`): who may
// edit what, and turning a submitted form into a valid change or field errors.

export const groupSettingsPath = (groupId: string) => `/app/groups/${groupId}/settings`;

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

import type { StaffCapability } from "@caretook/data/schema";
import type { ActionCopy } from "./helpActions";

import { ASSIGNABLE_ROLE_NAMES } from "@caretook/data/schema";
import { staffRoleLabel } from "../accountDisplay";

// The account actions beyond the help ones (admin PRD, slice 3): disable,
// re-enable and the staff role (admins only), and the care group limit
// (free-limits PRD; admin and support). Each takes a reason, like the help
// actions, and needs its own capability. Pure, tested.

export const ACCOUNT_ACTION_INTENTS = ["disable", "enable", "setRole", "setGroupLimit"] as const;
export type AccountActionIntent = (typeof ACCOUNT_ACTION_INTENTS)[number];

export const isAccountActionIntent = (value: unknown): value is AccountActionIntent =>
  ACCOUNT_ACTION_INTENTS.some((i) => i === value);

/** What each action needs (the API checks it again). */
export const ACCOUNT_ACTION_CAPABILITY: Record<AccountActionIntent, StaffCapability> = {
  disable: "users.disable",
  enable: "users.disable",
  setRole: "users.setRole",
  setGroupLimit: "users.limits",
};

export type AccountActionRequest = {
  intent: AccountActionIntent;
  reason: string;
  role?: string;
  /** The care group limit: null for the default (a blank field); NaN when it isn't a number, which the API refuses. */
  limit?: number | null;
};

/** A typed care group limit as the API takes it: blank is null (the default). */
export const parseGroupLimit = (text: string): number | null => (text.trim() === "" ? null : Number(text));

/** The posted form as an admin action, or null when its intent isn't one. */
export const parseAccountActionForm = (form: FormData): AccountActionRequest | null => {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const intent = text("intent");
  if (!isAccountActionIntent(intent)) return null;
  return {
    intent,
    reason: text("reason"),
    ...(intent === "setRole" ? { role: text("role") } : {}),
    ...(intent === "setGroupLimit" ? { limit: parseGroupLimit(text("limit")) } : {}),
  };
};

/** A role's name in a sentence: "an admin", "support", "a member". */
const roleInSentence = (role: string) =>
  role === "admin" ? "an admin" : role === "support" ? "support" : "a member";

/** What the page says after `intent` went through. */
export const accountActionDoneMessage = (
  intent: AccountActionIntent,
  result: { revoked?: number; role?: string; limit?: number; override?: number | null } = {},
) => {
  switch (intent) {
    case "disable": {
      const n = result.revoked ?? 0;
      return `Disabled. Signed out of ${n.toLocaleString("en-US")} ${n === 1 ? "session" : "sessions"}.`;
    }
    case "enable":
      return "Re-enabled. They can sign in again.";
    case "setRole":
      return `They're ${roleInSentence(result.role ?? "member")} now.`;
    case "setGroupLimit": {
      const n = result.limit ?? 0;
      const groups = `${n.toLocaleString("en-US")} care ${n === 1 ? "group" : "groups"}`;
      return result.override === null ? `Back to the default: ${groups}.` : `They can start ${groups} now.`;
    }
  }
};

export const DISABLE_COPY: ActionCopy = {
  button: "Disable account",
  title: "Disable this account?",
  message:
    "Every session is signed out now, and it can't sign in or sync until it's re-enabled; sync already under way can last up to 15 minutes. Its groups and data stay.",
  confirm: "Disable",
};

export const ENABLE_COPY: ActionCopy = {
  button: "Re-enable account",
  title: "Re-enable this account?",
  message: "It can sign in again with its password, an emailed link or a code. Its groups are as they were.",
  confirm: "Re-enable",
};

const ROLE_EFFECT: Record<(typeof ASSIGNABLE_ROLE_NAMES)[number], string> = {
  admin:
    "Admins can do everything in /admin, including disabling accounts, changing staff roles and settings.",
  support:
    "Support can look up accounts and groups and help with sign-in, but can't disable accounts, change staff roles or settings.",
  member: "They lose access to /admin.",
};

/** The staff roles to choose from, in order, with their labels. */
export const ROLE_OPTIONS = ASSIGNABLE_ROLE_NAMES.map((role) => ({
  role,
  label: staffRoleLabel(role) ?? "Member",
}));

/** The confirm for giving an account `role`. */
export const setRoleCopy = (role: string): ActionCopy => {
  const known = ASSIGNABLE_ROLE_NAMES.find((r) => r === role) ?? "member";
  return {
    button: "Change role",
    title: known === "member" ? "Remove their staff role?" : `Make them ${staffRoleLabel(known)}?`,
    message: ROLE_EFFECT[known],
    confirm: known === "member" ? "Remove role" : `Make ${staffRoleLabel(known)}`,
  };
};

/** The confirm for setting an account's care group limit to `limit` (null: the default). */
export const setGroupLimitCopy = (limit: number | null): ActionCopy => ({
  button: "Change limit",
  title:
    limit === null
      ? "Use the default limit?"
      : `Let them start ${limit.toLocaleString("en-US")} care ${limit === 1 ? "group" : "groups"}?`,
  message:
    "It counts the groups they started and still own; groups they were invited to or that staff started don't count. Groups they already have stay.",
  confirm: limit === null ? "Use default" : "Change limit",
});

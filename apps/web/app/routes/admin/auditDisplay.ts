import type { AuditAction, AuditChanges, AuditValue } from "@caretook/data/schema";

import { AUDIT_ACTION_LABELS } from "@caretook/data/schema";

// How the staff audit log reads, on /admin/audit and (later) on an account's
// and a group's page. Pure, tested.

type Person = { id: string; name: string | null; email: string | null };

/** Who acted: their name and email, or "System" (the `admin:grant` command). */
export const actorLabel = (actor: Person | null) =>
  actor
    ? actor.name
      ? `${actor.name} (${actor.email ?? "no email"})`
      : (actor.email ?? "Former staff")
    : "System";

/** The account or group acted on, by email or name; a deleted one says so. */
export const targetLabel = (entry: {
  targetUser: Person | null;
  targetGroup: { id: string; name: string | null } | null;
}) => {
  const parts: string[] = [];
  if (entry.targetUser) parts.push(entry.targetUser.email ?? "Deleted account");
  if (entry.targetGroup) parts.push(entry.targetGroup.name ?? "Deleted group");
  return parts.join(" · ");
};

export const actionLabel = (action: AuditAction) => AUDIT_ACTION_LABELS[action] ?? action;

const valueText = (value: AuditValue) =>
  value === null || value === "" ? "none" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** One line per changed field: "role: member → support" (a field with one value, "code: ABCD-…"). */
export const changeLines = (changes: AuditChanges) =>
  Object.entries(changes).map(([field, [before, after]]) =>
    JSON.stringify(before) === JSON.stringify(after)
      ? `${field}: ${valueText(after)}`
      : `${field}: ${valueText(before)} → ${valueText(after)}`,
  );

/** When, in UTC (staff work across zones). */
export const auditTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) +
  " UTC";

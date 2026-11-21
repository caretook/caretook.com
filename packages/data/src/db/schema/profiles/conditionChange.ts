import type { ConditionStatus, RecipientConditionContent } from "./recipientCondition";

import { z } from "zod";
import { uuidV5 } from "../core/uuidV5";
import { toChangeTime } from "../medications/medication";
import { CONDITION_STATUSES } from "./recipientCondition";

// A condition's history on the timeline (conditions PRD): every add, edit,
// resolve and reactivate writes one `conditionChange` entry, in the same
// transaction as the condition, like a medication's `medicationChange`. One
// pure builder (`conditionChange`) serves the service and the device, so
// both write the same entry, under the same derived id (`conditionChangeId`).
// Deleting a condition (a mistake) writes none. Client-safe.

/** The fields whose edits are recorded. A status change is the change itself (resolved, reactivated). */
export const CONDITION_TRACKED_FIELDS = ["name", "since", "note"] as const;
export type ConditionTrackedField = (typeof CONDITION_TRACKED_FIELDS)[number];

export const CONDITION_CHANGES = ["added", "changed", "resolved", "reactivated"] as const;
export type ConditionChangeType = (typeof CONDITION_CHANGES)[number];

/** A condition at one moment: what's set for `added`, only the changed fields otherwise. */
const conditionSummaryZSchema = z.strictObject({
  name: z.string().optional(),
  status: z.enum(CONDITION_STATUSES).optional(),
  sinceYear: z.int().nullable().optional(),
  sinceMonth: z.int().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type ConditionSummary = z.infer<typeof conditionSummaryZSchema>;

/**
 * A `conditionChange` entry: written with the condition, never by hand.
 * `conditionName` is its name after the change, so the entry reads (and is
 * found) on its own, also once the condition is deleted.
 * - `added`: `after` has the name, the status and what else is set.
 * - `changed`: `fields`, with `before` and `after` for just those.
 * - `resolved`, `reactivated`: the status changed; edits saved with it
 *   carry `fields`, `before` and `after` too.
 */
export const conditionChangeDetailsZSchema = z.strictObject({
  conditionId: z.uuid(),
  conditionName: z.string(),
  change: z.enum(CONDITION_CHANGES),
  fields: z.array(z.enum(CONDITION_TRACKED_FIELDS)).min(1).optional(),
  before: conditionSummaryZSchema.optional(),
  after: conditionSummaryZSchema.optional(),
});
export type ConditionChangeDetails = z.infer<typeof conditionChangeDetailsZSchema>;

type ChangeSource = Pick<RecipientConditionContent, "name" | "status" | "sinceYear" | "sinceMonth" | "note">;

const sameField = (field: ConditionTrackedField, a: ChangeSource, b: ChangeSource) =>
  field === "since"
    ? (a.sinceYear ?? null) === (b.sinceYear ?? null) && (a.sinceMonth ?? null) === (b.sinceMonth ?? null)
    : (a[field] ?? null) === (b[field] ?? null);

const fieldSummary = (source: ChangeSource, field: ConditionTrackedField): ConditionSummary =>
  field === "since"
    ? { sinceYear: source.sinceYear ?? null, sinceMonth: source.sinceMonth ?? null }
    : { [field]: source[field] ?? null };

const summaryOf = (source: ChangeSource, fields: readonly ConditionTrackedField[]): ConditionSummary =>
  Object.assign({}, ...fields.map((field) => fieldSummary(source, field))) as ConditionSummary;

/**
 * What a save did to a condition, as a `conditionChange` entry's details
 * (without the condition's id), or null when nothing the timeline records
 * changed. `before` is null for a new condition.
 */
export const conditionChange = (
  before: ChangeSource | null,
  after: ChangeSource,
): Omit<ConditionChangeDetails, "conditionId"> | null => {
  const conditionName = after.name;
  if (!before) {
    const set = CONDITION_TRACKED_FIELDS.filter((field) =>
      field === "since" ? after.sinceYear != null : after[field] != null,
    );
    return { conditionName, change: "added", after: { ...summaryOf(after, set), status: after.status } };
  }

  const fields = CONDITION_TRACKED_FIELDS.filter((field) => !sameField(field, before, after));
  const edits = fields.length
    ? { fields, before: summaryOf(before, fields), after: summaryOf(after, fields) }
    : {};
  if (before.status !== after.status)
    return { conditionName, change: after.status === "resolved" ? "resolved" : "reactivated", ...edits };
  return fields.length ? { conditionName, change: "changed", ...edits } : null;
};

/** The namespace for condition change entry ids (a fixed, random UUID; never change it). */
export const CONDITION_CHANGE_NAMESPACE = "c1ed8304-2312-4a46-b7e8-bedde49c6df6";

/**
 * A condition change entry's id: the version 5 UUID of the condition's id
 * and the time of the change (the condition's `updated_at` as the writer set
 * it), as `medicationChangeId`. The device's entry and the one the service
 * writes on upload are one row, and a replay changes nothing.
 */
export const conditionChangeId = (conditionId: string, changedAt: string | Date) => {
  const time = toChangeTime(changedAt);
  if (!time) throw new Error(`Not a time: ${String(changedAt)}`);
  return uuidV5(`${conditionId.toLowerCase()}:${time}`, CONDITION_CHANGE_NAMESPACE);
};

// ---------------------------------------------------------------------------
// Wording: the timeline's row, and later the assistant's text
// ---------------------------------------------------------------------------

const monthName = (month: number) =>
  new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(Date.UTC(2000, month - 1, 1));

/** "2015", "March 2021", or null (as the profile says it). */
export const conditionSinceWords = (sinceYear: number | null | undefined, sinceMonth?: number | null) => {
  if (sinceYear == null) return null;
  return sinceMonth != null && sinceMonth >= 1 && sinceMonth <= 12
    ? `${monthName(sinceMonth)} ${sinceYear}`
    : String(sinceYear);
};

const FIELD_LABELS: Record<ConditionTrackedField, string> = { name: "Name", since: "Since", note: "Note" };

const fieldValue = (field: ConditionTrackedField, summary: ConditionSummary | undefined) => {
  const value =
    field === "since"
      ? conditionSinceWords(summary?.sinceYear, summary?.sinceMonth)
      : summary?.[field]?.trim();
  return value || "none";
};

const HEADS: Record<ConditionChangeType, string> = {
  added: "Added",
  changed: "Changed",
  resolved: "Resolved",
  reactivated: "Reactivated",
};

const STATUS_WORDS: Record<ConditionStatus, string | null> = { active: null, resolved: "Resolved" };

/**
 * What a condition change entry says: a heading ("Added Type 2 diabetes",
 * "Resolved Hip fracture", "Changed Asthma") and its lines. An edit's lines
 * are before → after ("Since: 2015 → 2014", "Note: none → Diet-controlled");
 * an add's one line is what was set with it ("Since 2015 · Diet-controlled").
 */
export const conditionChangeText = (
  details: ConditionChangeDetails,
): { heading: string; lines: string[] } => {
  const heading = `${HEADS[details.change]} ${details.conditionName}`;
  if (details.change === "added") {
    const after = details.after ?? {};
    const since = conditionSinceWords(after.sinceYear, after.sinceMonth);
    const line = [
      after.status ? STATUS_WORDS[after.status] : null,
      since && `Since ${since}`,
      after.note?.trim() || null,
    ].filter(Boolean);
    return { heading, lines: line.length ? [line.join(" · ")] : [] };
  }
  const lines = (details.fields ?? []).map(
    (field) =>
      `${FIELD_LABELS[field]}: ${fieldValue(field, details.before)} → ${fieldValue(field, details.after)}`,
  );
  return { heading, lines };
};

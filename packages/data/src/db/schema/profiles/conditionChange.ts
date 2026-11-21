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

/**
 * The fields whose edits are recorded. A status change is the change itself
 * (resolved, reactivated). Who diagnosed it and who manages it (slice 3) are
 * recorded by name.
 */
export const CONDITION_TRACKED_FIELDS = ["name", "since", "note", "diagnosedBy", "managedBy"] as const;
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
  // Providers by name: who diagnosed it, and who manages it (by name).
  diagnosedBy: z.string().nullable().optional(),
  managedBy: z.array(z.string()).optional(),
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

/** A provider on a condition: compared by id, recorded by name. */
export type ConditionProviderRef = { id: string; name: string };

/**
 * A condition at one moment, as a writer knows it. `diagnosedBy` and
 * `managedBy` are left out when the save doesn't know them: a field is only
 * compared when both sides have it.
 */
export type ConditionChangeSource = Pick<
  RecipientConditionContent,
  "name" | "status" | "sinceYear" | "sinceMonth" | "note"
> & {
  diagnosedBy?: ConditionProviderRef | null;
  managedBy?: readonly ConditionProviderRef[];
};
type ChangeSource = ConditionChangeSource;

/** Names in a stable order, so a list compares and reads the same everywhere. */
export const managerNames = (refs: readonly { name: string }[]) =>
  refs
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }) || (a < b ? -1 : 1));

const sameIds = (a: readonly ConditionProviderRef[], b: readonly ConditionProviderRef[]) => {
  const ids = new Set(a.map((r) => r.id.toLowerCase()));
  return a.length === b.length && b.every((r) => ids.has(r.id.toLowerCase()));
};

const sameField = (field: ConditionTrackedField, a: ChangeSource, b: ChangeSource) => {
  switch (field) {
    case "since":
      return (
        (a.sinceYear ?? null) === (b.sinceYear ?? null) && (a.sinceMonth ?? null) === (b.sinceMonth ?? null)
      );
    case "diagnosedBy":
      if (a.diagnosedBy === undefined || b.diagnosedBy === undefined) return true;
      return (a.diagnosedBy?.id.toLowerCase() ?? null) === (b.diagnosedBy?.id.toLowerCase() ?? null);
    case "managedBy":
      if (a.managedBy === undefined || b.managedBy === undefined) return true;
      return sameIds(a.managedBy, b.managedBy);
    default:
      return (a[field] ?? null) === (b[field] ?? null);
  }
};

const fieldSummary = (source: ChangeSource, field: ConditionTrackedField): ConditionSummary => {
  switch (field) {
    case "since":
      return { sinceYear: source.sinceYear ?? null, sinceMonth: source.sinceMonth ?? null };
    case "diagnosedBy":
      return { diagnosedBy: source.diagnosedBy?.name ?? null };
    case "managedBy":
      return { managedBy: managerNames(source.managedBy ?? []) };
    default:
      return { [field]: source[field] ?? null };
  }
};

/** Whether a new condition has this field set (an add records only what's set). */
const isSet = (source: ChangeSource, field: ConditionTrackedField) => {
  switch (field) {
    case "since":
      return source.sinceYear != null;
    case "diagnosedBy":
      return !!source.diagnosedBy;
    case "managedBy":
      return !!source.managedBy?.length;
    default:
      return source[field] != null;
  }
};

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
    const set = CONDITION_TRACKED_FIELDS.filter((field) => isSet(after, field));
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

const byTrackedOrder = (fields: readonly ConditionTrackedField[]) =>
  CONDITION_TRACKED_FIELDS.filter((field) => fields.includes(field));

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((name, i) => name === b[i]);

/**
 * An entry's details with a change to who manages the condition folded in:
 * the server links and unlinks one provider at a time, and every link of one
 * save (one time, so one entry) lands in the same entry. `before` and
 * `after` are the managers' names around this one link or unlink. An add's
 * entry takes the managers into `after`; any other keeps the managers from
 * before the save's first link. Null when the entry is unchanged.
 */
export const withManagersChange = (
  details: ConditionChangeDetails,
  before: readonly string[],
  after: readonly string[],
): ConditionChangeDetails | null => {
  const names = managerNames(after.map((name) => ({ name })));
  if (details.change === "added") {
    const { managedBy: _, ...rest } = details.after ?? {};
    const next = { ...details, after: names.length ? { ...rest, managedBy: names } : rest };
    return sameNames(details.after?.managedBy ?? [], names) ? null : next;
  }
  const tracked = details.fields?.includes("managedBy") ?? false;
  const first = tracked ? (details.before?.managedBy ?? []) : managerNames(before.map((name) => ({ name })));
  if (tracked && sameNames(details.after?.managedBy ?? [], names)) return null;
  const { managedBy: _b, ...beforeRest } = details.before ?? {};
  const { managedBy: _a, ...afterRest } = details.after ?? {};
  const others = (details.fields ?? []).filter((f) => f !== "managedBy");
  // Back where the save started: only the other fields are left.
  if (sameNames(first, names)) {
    if (!tracked) return null;
    return {
      ...details,
      fields: others.length ? others : undefined,
      before: beforeRest,
      after: afterRest,
    };
  }
  return {
    ...details,
    fields: byTrackedOrder([...others, "managedBy"]),
    before: { ...beforeRest, managedBy: first },
    after: { ...afterRest, managedBy: names },
  };
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

const FIELD_LABELS: Record<ConditionTrackedField, string> = {
  name: "Name",
  since: "Since",
  note: "Note",
  diagnosedBy: "Diagnosed by",
  managedBy: "Managed by",
};

const fieldValue = (field: ConditionTrackedField, summary: ConditionSummary | undefined) => {
  const value =
    field === "since"
      ? conditionSinceWords(summary?.sinceYear, summary?.sinceMonth)
      : field === "managedBy"
        ? summary?.managedBy?.join(", ")
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
 * an add's one line is what was set with it ("Since 2015 · Diet-controlled ·
 * Managed by Dr. Lee").
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
      after.diagnosedBy?.trim() ? `Diagnosed by ${after.diagnosedBy.trim()}` : null,
      after.managedBy?.length ? `Managed by ${after.managedBy.join(", ")}` : null,
    ].filter(Boolean);
    return { heading, lines: line.length ? [line.join(" · ")] : [] };
  }
  const lines = (details.fields ?? []).map(
    (field) =>
      `${FIELD_LABELS[field]}: ${fieldValue(field, details.before)} → ${fieldValue(field, details.after)}`,
  );
  return { heading, lines };
};

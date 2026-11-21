import type { MedicationType } from "../medications/medication";
import { medicationTypeLabel } from "../medications/medicationTypeDisplay";
import { VITALS } from "../timeline/vitals";

// What each searchable thing's text is: one pure builder, used by the
// device's index. The server builds the same fields in SQL at query time;
// keep the two in step (the unit tests pin the field list).
//
// Two weighted fields: `title` (what the thing is called: titles, names)
// ranks above `body` (what's written about it: text, notes, place, author).
// Soft-deleted rows have no document, so they never match.

export const SEARCH_ITEM_TYPES = ["entry", "provider", "medication", "task", "condition"] as const;
export type SearchItemType = (typeof SEARCH_ITEM_TYPES)[number];

/** What server search (`searchService`) covers: tasks and conditions are searched on the device only. */
export const SERVER_SEARCH_ITEM_TYPES = [
  "entry",
  "provider",
  "medication",
] as const satisfies readonly SearchItemType[];
export type ServerSearchItemType = (typeof SERVER_SEARCH_ITEM_TYPES)[number];

export type SearchDocument = {
  id: string;
  type: SearchItemType;
  groupId: string;
  title: string;
  body: string;
};

type Text = string | null | undefined;

export type EntrySearchSource = {
  id: string;
  groupId: string;
  kind: string;
  title?: Text;
  body?: Text;
  /** The kind's details, parsed (a symptom's name, a vital's readings, a dose's medication and note). */
  details?: Record<string, unknown> | null;
  place?: Text;
  deletedAt?: Text;
  /** A note's or event's live document text, including edits not compacted yet. */
  documentText?: Text;
  authorName?: Text;
  /** Every linked provider's name. */
  providerNames?: Text[];
  /** The dose's or change's medication. */
  medication?: { name?: Text; strength?: Text } | null;
};

export type ProviderSearchSource = {
  id: string;
  groupId: string;
  name?: Text;
  specialty?: Text;
  practiceName?: Text;
  documentText?: Text;
  deletedAt?: Text;
};

export type MedicationSearchSource = {
  id: string;
  groupId: string;
  name?: Text;
  strength?: Text;
  /** The stored type; its label is searchable. Anything unknown or unset adds nothing. */
  type?: Text;
  reason?: Text;
  directions?: Text;
  documentText?: Text;
  deletedAt?: Text;
};

export type ConditionSearchSource = {
  id: string;
  groupId: string;
  name?: Text;
  note?: Text;
  deletedAt?: Text;
};

export type TaskSearchSource = {
  id: string;
  groupId: string;
  title?: Text;
  /** The task's live notes text, including edits not compacted yet. */
  documentText?: Text;
  deletedAt?: Text;
};

/** Non-empty parts, one per line (the tokenizers treat a line break as a word break). */
const join = (parts: Text[]) =>
  parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join("\n");

const str = (value: unknown): Text => (typeof value === "string" ? value : null);

/** A condition change's names: the condition's, and a renamed one's old and new. */
const conditionNames = (details: EntrySearchSource["details"]): Text[] => {
  const d = details as {
    conditionName?: unknown;
    before?: { name?: unknown } | null;
    after?: { name?: unknown } | null;
  } | null;
  return d ? [...new Set([str(d.conditionName), str(d.before?.name), str(d.after?.name)])] : [];
};

/** A vital's reading type names, as shown: "Blood pressure", "Sleep". Unknown types are skipped. */
const vitalNames = (details: EntrySearchSource["details"]) => {
  const readings = (details as { readings?: unknown } | null | undefined)?.readings;
  if (!Array.isArray(readings)) return [];
  return readings.map((r) => {
    const type = (r as { type?: unknown } | null)?.type;
    return typeof type === "string" && type in VITALS ? VITALS[type as keyof typeof VITALS].label : null;
  });
};

export const entrySearchDocument = (entry: EntrySearchSource): SearchDocument | null => {
  if (entry.deletedAt) return null;
  const details = entry.details ?? null;
  const medication = entry.medication
    ? [entry.medication.name, entry.medication.strength].filter(Boolean).join(" ")
    : null;
  return {
    id: entry.id,
    type: "entry",
    groupId: entry.groupId,
    title: join([
      entry.title,
      entry.kind === "symptom" ? str(details?.name) : null,
      ...vitalNames(details),
      medication,
      ...(entry.kind === "conditionChange" ? conditionNames(details) : []),
      ...(entry.providerNames ?? []),
    ]),
    body: join([
      entry.body,
      entry.documentText,
      // A dose's note, or a medication change's stop note.
      str(details?.note),
      str(details?.stopNote),
      entry.place,
      entry.authorName,
    ]),
  };
};

export const providerSearchDocument = (provider: ProviderSearchSource): SearchDocument | null => {
  if (provider.deletedAt) return null;
  return {
    id: provider.id,
    type: "provider",
    groupId: provider.groupId,
    title: join([provider.name, provider.specialty]),
    body: join([provider.practiceName, provider.documentText]),
  };
};

export const medicationSearchDocument = (medication: MedicationSearchSource): SearchDocument | null => {
  if (medication.deletedAt) return null;
  return {
    id: medication.id,
    type: "medication",
    groupId: medication.groupId,
    title: join([medication.name, medication.strength]),
    body: join([
      // The type reads as its label ("Over the counter"); a medication with no type says nothing.
      medication.type ? medicationTypeLabel(medication.type as MedicationType) : null,
      medication.reason,
      medication.directions,
      medication.documentText,
    ]),
  };
};

/** A task: its title weighted, its notes as body. Done tasks are found too (the page marks them). */
export const taskSearchDocument = (task: TaskSearchSource): SearchDocument | null => {
  if (task.deletedAt) return null;
  return {
    id: task.id,
    type: "task",
    groupId: task.groupId,
    title: join([task.title]),
    body: join([task.documentText]),
  };
};

/** One of the recipient's conditions: its name weighted, its note as body. Resolved ones are found too. */
export const conditionSearchDocument = (condition: ConditionSearchSource): SearchDocument | null => {
  if (condition.deletedAt) return null;
  return {
    id: condition.id,
    type: "condition",
    groupId: condition.groupId,
    title: join([condition.name]),
    body: join([condition.note]),
  };
};

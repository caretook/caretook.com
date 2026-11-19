import type {
  DoseDetails,
  MedicationChangeDetails,
  MedicationSchedule,
  MedicationStopReason,
  MedicationSummary,
  MedicationTrackedField,
  TimelineEntryDetails,
  TimelineEntryKind,
} from "@caretook/data/schema";

import { isDoseDetails, isMedicationChangeDetails } from "@caretook/data/schema";

// What doses and medication changes say on the timeline: "Lisinopril 10 mg"
// beside "Given 1 tablet", or "Changed dose 1 tablet → 2 tablets". No React or
// database here; unit-tested in web:unit.

/** The medication a dose or change is about, as the timeline names it. */
export type EntryMedication = {
  id: string;
  name: string;
  strength: string | null;
  /** ISO 8601, or null. A deleted medication is still named, but its page is gone. */
  deletedAt: string | null;
};

/** A timeline entry, with its medication when it's a dose or a change (`withMedication`). */
export type WithMedication = { medication?: EntryMedication | null };

/** "Lisinopril 10 mg", or just the name without a strength; "Medication" when it isn't on the device. */
export const medicationLabel = (medication: Pick<EntryMedication, "name" | "strength"> | null | undefined) =>
  medication ? [medication.name, medication.strength?.trim()].filter(Boolean).join(" ") : "Medication";

/** The medication a dose's or change's details name, or null for any other entry. */
export const medicationIdOf = (entry: {
  kind: TimelineEntryKind;
  details: TimelineEntryDetails | null;
}): string | null =>
  (entry.kind === "dose" && isDoseDetails(entry.details)) ||
  (entry.kind === "medicationChange" && isMedicationChangeDetails(entry.details))
    ? entry.details.medicationId
    : null;

/**
 * The entry with its medication looked up (`lookup` by id; null when it isn't
 * on the device). Any other entry comes back as it is.
 */
export const withMedication = <
  Entry extends { kind: TimelineEntryKind; details: TimelineEntryDetails | null },
>(
  entry: Entry,
  lookup: (medicationId: string) => EntryMedication | undefined,
): Entry & WithMedication => {
  const id = medicationIdOf(entry);
  return id ? { ...entry, medication: lookup(id) ?? null } : entry;
};

/** The medication `withMedication` attached, if any. */
export const entryMedication = (entry: object): EntryMedication | null | undefined =>
  "medication" in entry ? (entry as WithMedication).medication : undefined;

const DOSE_STATUS_TEXT = { given: "Given", skipped: "Skipped", refused: "Refused" } as const;

/** "Given 1 tablet", "Given", "Skipped" or "Refused". The amount is only said for a dose that was given. */
export const doseText = (details: Pick<DoseDetails, "status" | "amount">) => {
  const amount = details.amount?.trim();
  return details.status === "given" && amount ? `Given ${amount}` : DOSE_STATUS_TEXT[details.status];
};

/** "08:00" → "8:00". */
const time = (hhmm: string) => hhmm.replace(/^0(\d)/, "$1");

/** "a", "a and b", "a, b and c". */
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** "8:00 and 20:00", "As needed", "As needed, up to 4 a day". */
export const scheduleText = (schedule: MedicationSchedule) =>
  schedule.type === "scheduled"
    ? list(schedule.times.map(time))
    : schedule.maxPerDay
      ? `As needed, up to ${schedule.maxPerDay} a day`
      : "As needed";

const FIELD_LABEL: Record<MedicationTrackedField, string> = {
  name: "name",
  strength: "strength",
  form: "form",
  dose: "dose",
  directions: "directions",
  schedule: "schedule",
};

const fieldValue = (field: MedicationTrackedField, summary: MedicationSummary | undefined) => {
  if (field === "schedule") return summary?.schedule ? scheduleText(summary.schedule) : "none";
  return summary?.[field] || "none";
};

/** "dose 1 tablet → 2 tablets; schedule 8:00 → 8:00 and 20:00". */
const editsText = (details: MedicationChangeDetails) =>
  (details.fields ?? [])
    .map((f) => `${FIELD_LABEL[f]} ${fieldValue(f, details.before)} → ${fieldValue(f, details.after)}`)
    .join("; ");

const STOP_REASON_TEXT: Record<MedicationStopReason, string> = {
  sideEffects: "side effects",
  ineffective: "not working",
  prescriberStopped: "prescriber stopped it",
  other: "other reason",
};

/**
 * What a change to the list did: "Started", "Changed dose 1 tablet → 2
 * tablets", "Discontinued: side effects", "Completed", "Resumed". A stop or
 * restart saved with edits says those too ("Resumed · dose 1 tablet → 2 tablets").
 */
export const changeText = (details: MedicationChangeDetails) => {
  const edits = editsText(details);
  switch (details.change) {
    case "started":
      return "Started";
    case "changed":
      return edits ? `Changed ${edits}` : "Changed";
    case "stopped": {
      const stop =
        details.stopStatus === "completed"
          ? "Completed"
          : `Discontinued${details.stopReason ? `: ${STOP_REASON_TEXT[details.stopReason]}` : ""}`;
      return edits ? `${stop} · ${edits}` : stop;
    }
    case "resumed":
      return edits ? `Resumed · ${edits}` : "Resumed";
  }
};

/**
 * A dose's or change's two parts: what happened ("Given 1 tablet") and its
 * note (a dose's note, a stop's note), or null for any other entry.
 */
export const medicationEntryText = (entry: {
  kind: TimelineEntryKind;
  details: TimelineEntryDetails | null;
}): { what: string; note: string | null } | null => {
  if (entry.kind === "dose" && isDoseDetails(entry.details))
    return { what: doseText(entry.details), note: entry.details.note?.trim() || null };
  if (entry.kind === "medicationChange" && isMedicationChangeDetails(entry.details))
    return { what: changeText(entry.details), note: entry.details.stopNote?.trim() || null };
  return null;
};

import type { TimelineEntryDetails, TimelineEntryKind, SchedulePass } from "@caretook/data/schema";

import {
  isDoseDetails,
  isMedicationChangeDetails,
  isPassMovedDetails,
  changeText,
  doseText,
  passMovedText,
} from "@caretook/data/schema";
import { removedChangeText } from "../timeline/entryDisplay";

// The dose, schedule and change wording is `medicationDisplay`'s, shared with
// the medication page; re-exported so the timeline imports one module.
export { changeText, doseText, passMovedText, scheduleText } from "@caretook/data/schema";

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

/**
 * A timeline entry, with its medication when it's a dose or a change, and the
 * group's passes on a change (which a schedule edit names) (`withMedication`).
 */
export type WithMedication = {
  medication?: EntryMedication | null;
  schedulePasses?: readonly SchedulePass[];
};

/** What a deleted medication reads as: its name went with it (a delete scrubs the row). */
export const REMOVED_MEDICATION = "Removed medication";

/**
 * "Lisinopril 10 mg", or just the name without a strength; "Removed
 * medication" once it's deleted; "Medication" when it isn't on the device.
 */
export const medicationLabel = (
  medication: (Pick<EntryMedication, "name" | "strength"> & { deletedAt?: string | null }) | null | undefined,
) =>
  !medication
    ? "Medication"
    : medication.deletedAt
      ? REMOVED_MEDICATION
      : [medication.name, medication.strength?.trim()].filter(Boolean).join(" ");

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
 * on the device), and a change with the group's `passes` (deleted ones too),
 * so a schedule edit reads by pass name. Any other entry comes back as it is.
 */
export const withMedication = <
  Entry extends { kind: TimelineEntryKind; details: TimelineEntryDetails | null },
>(
  entry: Entry,
  lookup: (medicationId: string) => EntryMedication | undefined,
  passes?: readonly SchedulePass[],
): Entry & WithMedication => {
  const id = medicationIdOf(entry);
  if (!id) return entry;
  const medication = lookup(id) ?? null;
  return entry.kind === "medicationChange" && passes
    ? { ...entry, medication, schedulePasses: passes }
    : { ...entry, medication };
};

/** The medication `withMedication` attached, if any. */
export const entryMedication = (entry: object): EntryMedication | null | undefined =>
  "medication" in entry ? (entry as WithMedication).medication : undefined;

/**
 * A dose's or change's two parts: what happened ("Given 1 tablet") and its
 * note (a dose's note, a stop's note), or null for any other entry. A pass's
 * move names no medication: its `what` is the whole line ("Morning moved
 * 8:00 → 8:30"), shown on its own (`standalone`). A deleted medication's
 * change lost its summary with the medication: the whole line is "Removed
 * medication changed" (`removed`).
 */
export const medicationEntryText = (
  entry: {
    kind: TimelineEntryKind;
    details: TimelineEntryDetails | null;
  } & WithMedication,
): { what: string; note: string | null; standalone?: true; removed?: true } | null => {
  if (entry.kind === "medicationChange" && isPassMovedDetails(entry.details))
    return { what: passMovedText(entry.details), note: null, standalone: true };
  if (entry.kind === "dose" && isDoseDetails(entry.details))
    return { what: doseText(entry.details), note: entry.details.note?.trim() || null };
  if (
    entry.kind === "medicationChange" &&
    isMedicationChangeDetails(entry.details) &&
    entry.medication?.deletedAt
  )
    return { what: removedChangeText(REMOVED_MEDICATION), note: null, removed: true };
  if (entry.kind === "medicationChange" && isMedicationChangeDetails(entry.details))
    return {
      what: changeText(entry.details, entry.schedulePasses),
      note: entry.details.stopNote?.trim() || null,
    };
  return null;
};

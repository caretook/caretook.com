import type { TimelineEntryDetails } from "@caretook/data/schema";
import type { LastEntryRow } from "./easyRows";

import { isSymptomDetails } from "@caretook/data/schema";
import { isEntryKind, KIND_META } from "../../../../lib/timeline/entryDisplay";

// Easy mode's "Remove my last entry" (assistant PRD): after Undo has gone,
// you can still take back the latest entry you added in the last 30 minutes,
// then the one before it. Only your own, and never one written for you (a
// medication or condition change). Pure, so web:unit tests it.

/** How long after adding an entry you can remove it from easy mode. */
export const REMOVE_WINDOW_MS = 30 * 60_000;

/** Your latest entry when it's still yours to remove at `now`; else null. */
export const removableEntry = <Row extends Pick<LastEntryRow, "created_at">>(
  row: Row | null | undefined,
  now: Date,
): Row | null => {
  if (!row) return null;
  // PowerSync's text has microseconds (and may have a space for the T).
  const created = new Date(row.created_at.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1"));
  const age = now.getTime() - created.getTime();
  // A device clock a little behind the one that made it counts as just now.
  return age <= REMOVE_WINDOW_MS ? row : null;
};

const parse = (json: string | null): TimelineEntryDetails | null => {
  try {
    // Checked by the guard that reads it.
    return json ? (JSON.parse(json) as TimelineEntryDetails) : null;
  } catch {
    return null;
  }
};

/** What the confirm calls it: "Symptom: Feeling", "Note: Lunch", "Vitals". */
export const lastEntryName = (row: Pick<LastEntryRow, "kind" | "title" | "details">) => {
  const kind = isEntryKind(row.kind) ? KIND_META[row.kind].label : "Entry";
  const details = parse(row.details);
  const name = isSymptomDetails(details) ? details.name : row.title;
  return name?.trim() ? `${kind}: ${name.trim()}` : kind;
};

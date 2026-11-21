import type { TimedEntry } from "./upcoming";

import { entryTiming } from "./upcoming";

// When a change to a series visit asks "Only this visit" or "This and later
// visits" (appointments-2, slice 2), and how the question is worded. Pure;
// web:unit tests it. The writes are `planSeriesEdit`'s (`@caretook/data/series`).

export type SeriesAction = "edit" | "cancel" | "reschedule" | "delete";

/** What the scope question reads from an entry (a `TimelineEntry` has it all). */
export type ScopedEntry = TimedEntry & {
  kind: string;
  seriesId?: string | null;
  seriesDetached?: boolean;
};

/**
 * Whether a change from a ⋯ menu asks the scope: a visit of a series that
 * hasn't started yet. A past visit only ever changes on its own.
 */
export const asksScope = (entry: ScopedEntry, now: Date) =>
  !!entry.seriesId && entryTiming(entry, now) === "upcoming";

/**
 * Whether an edit made on the entry page itself (its title, time or place)
 * asks: as above, unless the visit was already changed on its own (detached),
 * whose fields are its own.
 */
export const asksScopeOnEdit = (entry: ScopedEntry, now: Date) =>
  asksScope(entry, now) && !entry.seriesDetached;

const VERBS: Record<SeriesAction, string> = {
  edit: "Change",
  cancel: "Cancel",
  reschedule: "Reschedule",
  delete: "Delete",
};

/** The dialog's title and message: "Delete a repeating appointment", … */
export const scopeQuestion = (action: SeriesAction) => {
  return {
    title: `${VERBS[action]} a repeating appointment`,
    message:
      action === "edit" || action === "reschedule"
        ? "Change only this visit, or this one and the visits after it? Past visits stay as they were."
        : `${VERBS[action]} only this visit, or this one and the visits after it? The series ends here if you choose later visits.`,
  };
};

/** Where "Only this visit" from a row's Edit lands: the entry page, already scoped to this visit. */
export const ONLY_THIS_VISIT_STATE = { seriesScope: "only" } as const;

/** Whether the entry page was opened by "Only this visit" (its edits then don't ask again). */
export const openedForOnlyThisVisit = (state: unknown) =>
  !!state && typeof state === "object" && (state as { seriesScope?: unknown }).seriesScope === "only";

import type { DoseStatus, SymptomDetails, VitalDetails } from "@caretook/data/schema";

// What quick entry's Edit hands the usual sheets: a draft in history state
// (never in the URL), which the add sheet and the Dose sheet start from.
// Pure; web:unit tests it.

/** A symptom or vital the add sheet starts from (history state, so nothing is in the URL). */
export type EntryDraft = {
  kind: "symptom" | "vital";
  details: SymptomDetails | VitalDetails;
  body: string | null;
  occurredAt: string;
};

/** A dose the Dose sheet starts from. */
export type DoseDraft = {
  status: DoseStatus;
  amount: string | null;
  note: string | null;
  occurredAt: string;
};

/** The history state key both sheets read their draft from. */
export const QUICK_ENTRY_DRAFT = "quickEntryDraft";

const draftOf = <T>(state: unknown): T | null =>
  typeof state === "object" && state !== null && QUICK_ENTRY_DRAFT in state
    ? ((state as Record<string, unknown>)[QUICK_ENTRY_DRAFT] as T)
    : null;

/** The add sheet's draft from its history state, if it was opened from quick entry. */
export const entryDraftFrom = (state: unknown) => {
  const draft = draftOf<EntryDraft>(state);
  return draft && (draft.kind === "symptom" || draft.kind === "vital") ? draft : null;
};

/** The Dose sheet's draft from its history state, if it was opened from quick entry. */
export const doseDraftFrom = (state: unknown) => {
  const draft = draftOf<DoseDraft>(state);
  return draft && typeof draft.status === "string" ? draft : null;
};

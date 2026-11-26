import type {
  ActionOf,
  DoseStatus,
  NewMedicationDraft,
  NewProviderDraft,
  SymptomDetails,
  VitalDetails,
} from "@caretook/data/schema";

import { MEDICATION_FORMS, PROVIDER_TYPES } from "@caretook/data/schema";

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

/**
 * A provider event quick entry opens on the new-event page instead of
 * writing it (`entries/new?kind=event`): what that page starts from. Nothing
 * is written until the page's own save.
 */
export type EventDraft = {
  kind: "event";
  title: string;
  occurredAt: string;
  allDay: boolean;
  place: string | null;
  providerIds: string[];
  /** The zone its day and time are in (the recipient's): an all-day event starts at its midnight. */
  timeZone: string;
};

/** The draft for a quick entry event (an `addEvent` action). */
export const eventDraftFor = (action: ActionOf<"addEvent">): EventDraft => ({
  kind: "event",
  title: action.title,
  occurredAt: action.occurredAt,
  allDay: !!action.allDay,
  place: action.place ?? null,
  providerIds: [...action.providerIds],
  timeZone: action.timeZone,
});

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

/** The new-event page's draft from its history state, if quick entry opened it (anything malformed is dropped). */
export const eventDraftFrom = (state: unknown): EventDraft | null => {
  const draft = draftOf<Partial<Record<keyof EventDraft, unknown>>>(state);
  if (!draft || typeof draft !== "object" || draft.kind !== "event") return null;
  const { title, occurredAt, allDay, place, providerIds, timeZone } = draft;
  if (typeof title !== "string" || typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt)))
    return null;
  if (typeof timeZone !== "string" || !isStrings(providerIds)) return null;
  return {
    kind: "event",
    title,
    occurredAt,
    allDay: allDay === true,
    place: typeof place === "string" && place.trim() ? place : null,
    providerIds: [...providerIds],
    timeZone,
  };
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const textOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const oneOf = <T extends string>(options: readonly T[], value: unknown): T | null =>
  (options as readonly unknown[]).includes(value) ? (value as T) : null;

/**
 * The Add medication sheet's draft from its history state, if quick entry
 * opened it ("new med lisinopril 10 mg tablet"): name, strength, form and
 * directions (anything malformed is dropped). The sheet saves as it always does.
 */
export const medicationDraftFrom = (state: unknown): NewMedicationDraft | null => {
  const draft = draftOf<Record<string, unknown>>(state);
  if (!draft || typeof draft !== "object" || draft.kind !== "medication") return null;
  return {
    kind: "medication",
    name: text(draft.name),
    strength: textOrNull(draft.strength),
    form: oneOf(MEDICATION_FORMS, draft.form),
    directions: textOrNull(draft.directions),
  };
};

/** The Add provider sheet's draft from its history state, if quick entry opened it ("add provider Dr Kim cardiology"). */
export const providerDraftFrom = (state: unknown): NewProviderDraft | null => {
  const draft = draftOf<Record<string, unknown>>(state);
  if (!draft || typeof draft !== "object" || draft.kind !== "provider") return null;
  return {
    kind: "provider",
    type: oneOf(PROVIDER_TYPES, draft.type) ?? "clinician",
    name: text(draft.name),
    specialty: textOrNull(draft.specialty),
    practiceId: textOrNull(draft.practiceId),
    phone: textOrNull(draft.phone),
    address: textOrNull(draft.address),
  };
};

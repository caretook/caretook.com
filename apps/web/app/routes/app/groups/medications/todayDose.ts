import type { DoseStatus } from "@caretook/data/schema";
import type { DoseInput } from "../../../../lib/sync/medications";

import { formString } from "../../../../lib/form";

// What Today posts to the medications route's clientAction (one tap on
// Given, Skipped or Refused with a note, an as-needed Log), and how the
// action reads it back. Logged now. Pure, so web:unit tests it.

export const LOG_DOSE_INTENT = "logDose";

export type TodayDose = {
  medicationId: string;
  status: DoseStatus;
  /** The slot it answers ("08:00"); none for an as-needed dose. */
  scheduledFor?: string | null;
  /** The pass that slot is in, when it's in one. */
  passId?: string | null;
  amount?: string | null;
  note?: string | null;
};

/** The fields a fetcher posts for a dose. */
export const todayDoseFields = (dose: TodayDose): Record<string, string> => ({
  intent: LOG_DOSE_INTENT,
  medicationId: dose.medicationId,
  status: dose.status,
  scheduledFor: dose.scheduledFor ?? "",
  passId: dose.passId ?? "",
  amount: dose.amount?.trim() ?? "",
  note: dose.note?.trim() ?? "",
});

const optional = (value: string) => value.trim() || null;

/** A posted dose as `logDose` takes it (logged now), or null when the form isn't one. */
export const todayDoseFromForm = (form: FormData): DoseInput | null => {
  if (formString(form, "intent") !== LOG_DOSE_INTENT) return null;
  return {
    medicationId: formString(form, "medicationId"),
    // An unknown status is left for the write's validation to refuse.
    status: formString(form, "status") as DoseStatus,
    scheduledFor: optional(formString(form, "scheduledFor")),
    passId: optional(formString(form, "passId")),
    amount: optional(formString(form, "amount")),
    note: optional(formString(form, "note")),
  };
};

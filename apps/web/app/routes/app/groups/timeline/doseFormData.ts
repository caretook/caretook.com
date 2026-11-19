import type { DoseStatus } from "@caretook/data/schema";
import type { DoseInput, DosePatch } from "../../../../lib/sync/medications";

import { DOSE_STATUSES } from "@caretook/data/schema";
import { formString } from "../../../../lib/form";
import { parseOccurredAt } from "./entryFormData";

// What the Dose sheet posts, as the medications module's writes take it.
// Pure, so web:unit tests it.

const optional = (value: string) => value.trim() || null;

/** The posted status; an unknown one is left for the write's validation to refuse. */
const statusOf = (form: FormData) => formString(form, "status") as DoseStatus;

/** The Dose sheet's choices, in order. */
export const DOSE_STATUS_OPTIONS = DOSE_STATUSES.map((value) => ({
  value,
  label: { given: "Given", skipped: "Skipped", refused: "Refused" }[value],
}));

/** A new dose: the medication, status, amount, the slot it answers, the note and when (ISO 8601, or "" when unreadable). */
export const doseFromForm = (form: FormData): DoseInput & { occurredAt: string } => ({
  medicationId: formString(form, "medicationId"),
  status: statusOf(form),
  amount: optional(formString(form, "amount")),
  scheduledFor: optional(formString(form, "scheduledFor")),
  note: optional(formString(form, "note")),
  occurredAt: parseOccurredAt(formString(form, "occurredAt")),
});

/** An edit to a logged dose: everything but its medication and slot. A blank amount or note clears it. */
export const dosePatchFromForm = (form: FormData): DosePatch => ({
  status: statusOf(form),
  amount: optional(formString(form, "amount")),
  note: optional(formString(form, "note")),
  occurredAt: parseOccurredAt(formString(form, "occurredAt")),
});

import type { DoseStatus } from "@caretook/data/schema";
import type { DoseSlot, DueDoses } from "../../../../lib/medications/dueDoses";
import type { DoseChoice } from "../../../../lib/medications/medicationTimeline.sync";
import type {
  DoseInput,
  DosePatch,
  NewMedicationDose,
  QuickAddMedication,
} from "../../../../lib/medications/medications.sync";

import { DOSE_STATUSES } from "@caretook/data/schema";
import { isDueNow } from "../../../../lib/medications/dueDoses";
import { formString } from "../../../../lib/core/form";
import { dueSlotLabel } from "../../../../lib/medications/medicationDisplay";
import { medicationLabel } from "../../../../lib/medications/medicationEntries";
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

/** A new dose: the medication and the slot it answers, status, amount, the note and when (ISO 8601, or "" when unreadable). */
export const doseFromForm = (form: FormData): DoseInput & { occurredAt: string } => {
  // The choice is a medication, or a medication's slot ("<id>@08:00").
  const choice = parseDoseOption(formString(form, "medicationId"));
  return {
    medicationId: choice.medicationId,
    status: statusOf(form),
    amount: optional(formString(form, "amount")),
    scheduledFor: choice.slot ?? optional(formString(form, "scheduledFor")),
    // Only with a slot: the pass that slot is in.
    passId: choice.slot ? optional(formString(form, "passId")) : null,
    note: optional(formString(form, "note")),
    occurredAt: parseOccurredAt(formString(form, "occurredAt")),
  };
};

/**
 * The Dose sheet's last choice, "+ New medication": a reserved value (never
 * a medication's id, which is a UUID) that shows the quick add's name, dose
 * and type.
 */
export const NEW_MEDICATION_OPTION = "new";

/** The quick add's fields, as the form posts them (the dose's are `doseFromForm`'s). */
export const QUICK_ADD_FIELD = { name: "name", dose: "dose", type: "type" } as const;

/**
 * A dose of a medication added with it ("+ New medication"): the
 * medication's name, dose and type, and the dose as `doseFromForm` reads it;
 * null when the choice is a medication already on the list.
 */
export const quickAddFromForm = (
  form: FormData,
): { medication: QuickAddMedication; dose: NewMedicationDose & { occurredAt: string } } | null => {
  if (formString(form, "medicationId") !== NEW_MEDICATION_OPTION) return null;
  const { medicationId: _, ...dose } = doseFromForm(form);
  return {
    medication: {
      name: formString(form, QUICK_ADD_FIELD.name),
      dose: optional(formString(form, QUICK_ADD_FIELD.dose)),
      type: optional(formString(form, QUICK_ADD_FIELD.type)),
    },
    dose,
  };
};

/** An edit to a logged dose: everything but its medication and slot. A blank amount or note clears it. */
export const dosePatchFromForm = (form: FormData): DosePatch => ({
  status: statusOf(form),
  amount: optional(formString(form, "amount")),
  note: optional(formString(form, "note")),
  occurredAt: parseOccurredAt(formString(form, "occurredAt")),
});

/** One choice in the Dose sheet: a medication, a medication's slot ("08:00"), or "+ New medication". */
export type DoseOption = {
  value: string;
  label: string;
  medicationId: string;
  slot: string | null;
  /** The pass the slot is in, when it's in one. */
  passId: string | null;
  /** What's given: the slot's amount, else the medication's dose. */
  dose: string | null;
};

/** "+ New medication", always last: with no current medications, the only choice. */
const NEW_MEDICATION_CHOICE: DoseOption = {
  value: NEW_MEDICATION_OPTION,
  label: "+ New medication",
  medicationId: "",
  slot: null,
  passId: null,
  // The quick add's typed dose stands in for it (`DoseForm`).
  dose: null,
};

const optionValue = (medicationId: string, slot: string | null) =>
  slot ? `${medicationId}@${slot}` : medicationId;

/** A choice's value back as its medication and slot. */
export const parseDoseOption = (value: string) => {
  const [medicationId = "", slot = null] = value.split("@");
  return { medicationId, slot };
};

/**
 * The Dose sheet's choices: the slots due now first (overdue ones say so),
 * with the slot the sheet was opened for at the top when it isn't one of
 * them; then every current medication without a slot, as `choices` orders
 * them (most recently given first); last, "+ New medication". `initial` is
 * the choice to start on (the first; with no medications, the new one).
 * Slots in `shownPasses` (the passes the sheet shows above, with Given all
 * and each medication) aren't repeated here, unless asked for.
 */
export function doseSheetOptions(
  choices: readonly DoseChoice[],
  due: Pick<DueDoses, "slots">,
  requested: { medicationId: string | null; slot: string | null },
  shownPasses: ReadonlySet<string> = new Set(),
): { options: DoseOption[]; initial: string | null } {
  const byId = new Map(choices.map((c) => [c.id, c]));
  const slotOptions: DoseOption[] = [];
  const seen = new Set<string>();
  const add = (
    slot: Pick<DoseSlot, "time" | "state"> &
      Partial<Pick<DoseSlot, "passId" | "amount">> & { medicationId: string },
  ) => {
    const choice = byId.get(slot.medicationId);
    const value = optionValue(slot.medicationId, slot.time);
    if (!choice || seen.has(value)) return;
    seen.add(value);
    slotOptions.push({
      value,
      label: dueSlotLabel({ medication: choice, time: slot.time, state: slot.state }),
      medicationId: choice.id,
      slot: slot.time,
      passId: slot.passId ?? null,
      dose: slot.amount !== undefined ? slot.amount : choice.dose,
    });
  };
  if (requested.medicationId && requested.slot) {
    const today = due.slots.find(
      (s) => s.medication.id === requested.medicationId && s.time === requested.slot,
    );
    add({
      medicationId: requested.medicationId,
      time: requested.slot,
      state: today?.state ?? "upcoming",
      ...(today && { passId: today.passId, amount: today.amount }),
    });
  }
  for (const slot of due.slots.filter(isDueNow))
    if (!slot.passId || !shownPasses.has(slot.passId)) add({ ...slot, medicationId: slot.medication.id });

  const options = [
    ...slotOptions,
    ...choices.map((c) => ({
      value: c.id,
      label: medicationLabel(c),
      medicationId: c.id,
      slot: null,
      passId: null,
      dose: c.dose,
    })),
    NEW_MEDICATION_CHOICE,
  ];
  const wanted =
    requested.medicationId && byId.has(requested.medicationId)
      ? optionValue(requested.medicationId, requested.slot)
      : null;
  return { options, initial: wanted ?? options[0]?.value ?? null };
}

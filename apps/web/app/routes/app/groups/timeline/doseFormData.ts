import type { DoseStatus } from "@caretook/data/schema";
import type { DoseSlot, DueDoses } from "../../../../lib/dueDoses";
import type { DoseChoice } from "../../../../lib/sync/medicationTimeline";
import type { DoseInput, DosePatch } from "../../../../lib/sync/medications";

import { DOSE_STATUSES } from "@caretook/data/schema";
import { isDueNow } from "../../../../lib/dueDoses";
import { formString } from "../../../../lib/form";
import { dueSlotLabel } from "../../../../lib/medicationDisplay";
import { medicationLabel } from "../../../../lib/medicationEntries";
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

/** An edit to a logged dose: everything but its medication and slot. A blank amount or note clears it. */
export const dosePatchFromForm = (form: FormData): DosePatch => ({
  status: statusOf(form),
  amount: optional(formString(form, "amount")),
  note: optional(formString(form, "note")),
  occurredAt: parseOccurredAt(formString(form, "occurredAt")),
});

/** One choice in the Dose sheet: a medication, or a medication's slot ("08:00"). */
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
 * them (most recently given first). `initial` is the choice to start on.
 */
export function doseSheetOptions(
  choices: readonly DoseChoice[],
  due: Pick<DueDoses, "slots">,
  requested: { medicationId: string | null; slot: string | null },
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
  for (const slot of due.slots.filter(isDueNow)) add({ ...slot, medicationId: slot.medication.id });

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
  ];
  const wanted =
    requested.medicationId && byId.has(requested.medicationId)
      ? optionValue(requested.medicationId, requested.slot)
      : null;
  return { options, initial: wanted ?? options[0]?.value ?? null };
}

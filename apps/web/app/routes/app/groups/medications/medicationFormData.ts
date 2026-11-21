import type { MedicationForm, MedicationSchedule, MedicationType, ScheduleSlot } from "@caretook/data/schema";
import type { FieldIssue } from "../../../../lib/core/api";
import type { NewMedicationProviders } from "../../../../lib/medications/medications.sync";

import { MEDICATION_FORMS, MEDICATION_TYPES } from "@caretook/data/schema";

// The medication sheet's form as a medication: the fields `MedicationForm`
// posts, read into the shape the device writes (`createMedication`,
// `updateMedication`) validate. The status fields aren't on the form (the
// status actions change them). Pure, so web:unit tests it.

/** The form's field names. */
export const FIELD = {
  name: "name",
  /** Prescription, otc, supplement or other (required on save). */
  type: "type",
  strength: "strength",
  form: "form",
  dose: "dose",
  directions: "directions",
  reason: "reason",
  scheduleType: "scheduleType",
  /** A ticked pass's check box (its value is the pass's id). */
  passId: "passId",
  time: "time",
  /** A time row's amount, beside its `time` (one each per row, so they line up). */
  timeAmount: "timeAmount",
  maxPerDay: "maxPerDay",
  startedOn: "startedOn",
  prescriberId: "prescriberId",
  newPrescriber: "newPrescriber",
  pharmacyId: "pharmacyId",
  newPharmacy: "newPharmacy",
  lastFilledOn: "lastFilledOn",
  quantity: "quantity",
  refillsLeft: "refillsLeft",
  rxNumber: "rxNumber",
  /** A chosen condition the medication is for (one hidden field each; conditions slice 4). */
  conditionId: "conditionId",
} as const;

/** A pass's amount field: "passAmount:<passId>". */
export const passAmountField = (passId: string) => `passAmount:${passId}`;

/** What the form edits: every content field but the status ones. */
export type MedicationFormInput = {
  name: string;
  /** None chosen (an old medication) is null: the save refuses it. */
  type: MedicationType | null;
  strength: string;
  form: MedicationForm | null;
  dose: string;
  directions: string;
  reason: string;
  schedule: MedicationSchedule;
  startedOn: string | null;
  prescriberId: string | null;
  pharmacyId: string | null;
  lastFilledOn: string | null;
  quantity: string;
  refillsLeft: number | null;
  rxNumber: string;
};

export type MedicationFormData = {
  input: MedicationFormInput;
  /** A prescriber or pharmacy to add by name, written with the medication. */
  newProviders: NewMedicationProviders;
  /** Where each slot sent came from: a pass's check box, or a time row (blank rows are left out). */
  slotRows: SlotRow[];
  /** The conditions it's for (written beside the medication: `setMedicationConditions`). */
  conditionIds: string[];
};

/** A schedule slot's place in the form. */
export type SlotRow = { pass: string } | { time: number };

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/** A number field: empty is none; anything else is passed on for the schema to judge ("1.5" is refused there). */
const number = (form: FormData, name: string) => {
  const value = text(form, name).trim();
  return value === "" ? null : Number(value);
};

const isForm = (value: string): value is MedicationForm =>
  (MEDICATION_FORMS as readonly string[]).includes(value);

const isType = (value: string): value is MedicationType =>
  (MEDICATION_TYPES as readonly string[]).includes(value);

/**
 * The medication in a submitted form. A scheduled medication's slots are the
 * ticked passes (each with its amount, if typed), then the time rows with a
 * time (each with its amount); blank time rows are dropped. An as-needed
 * one's maximum is read instead, by the chosen schedule type. A new
 * prescriber's or pharmacy's name replaces a chosen one. Validation is the
 * write's (the shared Zod schema), so this never refuses anything.
 */
export const medicationFromForm = (form: FormData): MedicationFormData => {
  const slots: ScheduleSlot[] = [];
  const slotRows: SlotRow[] = [];
  const withAmount = <S extends ScheduleSlot>(slot: S, amount: string): S =>
    amount ? { ...slot, amount } : slot;
  const passIds = form.getAll(FIELD.passId).flatMap((v) => (typeof v === "string" && v ? [v] : []));
  for (const passId of new Set(passIds)) {
    slots.push(withAmount({ passId }, text(form, passAmountField(passId)).trim()));
    slotRows.push({ pass: passId });
  }
  const amounts = form.getAll(FIELD.timeAmount);
  form.getAll(FIELD.time).forEach((value, row) => {
    const time = typeof value === "string" ? value.trim() : "";
    if (!time) return;
    const amount = amounts[row];
    slots.push(withAmount({ time }, typeof amount === "string" ? amount.trim() : ""));
    slotRows.push({ time: row });
  });
  const maxPerDay = number(form, FIELD.maxPerDay);
  const schedule: MedicationSchedule =
    text(form, FIELD.scheduleType) === "asNeeded"
      ? maxPerDay === null
        ? { type: "asNeeded" }
        : { type: "asNeeded", maxPerDay }
      : { type: "scheduled", slots };

  const newPrescriber = text(form, FIELD.newPrescriber).trim();
  const newPharmacy = text(form, FIELD.newPharmacy).trim();
  const newProviders: NewMedicationProviders = {
    ...(newPrescriber && { prescriber: newPrescriber }),
    ...(newPharmacy && { pharmacy: newPharmacy }),
  };
  const rawForm = text(form, FIELD.form);
  const rawType = text(form, FIELD.type);

  return {
    input: {
      name: text(form, FIELD.name),
      type: isType(rawType) ? rawType : null,
      strength: text(form, FIELD.strength),
      form: isForm(rawForm) ? rawForm : null,
      dose: text(form, FIELD.dose),
      directions: text(form, FIELD.directions),
      reason: text(form, FIELD.reason),
      schedule,
      startedOn: text(form, FIELD.startedOn) || null,
      prescriberId: newPrescriber ? null : text(form, FIELD.prescriberId) || null,
      pharmacyId: newPharmacy ? null : text(form, FIELD.pharmacyId) || null,
      lastFilledOn: text(form, FIELD.lastFilledOn) || null,
      quantity: text(form, FIELD.quantity),
      refillsLeft: number(form, FIELD.refillsLeft),
      rxNumber: text(form, FIELD.rxNumber),
    },
    newProviders,
    slotRows,
    conditionIds: [
      ...new Set(form.getAll(FIELD.conditionId).flatMap((v) => (typeof v === "string" && v ? [v] : []))),
    ],
  };
};

/**
 * Issues on sent slots moved to the form's fields, so they show in the right
 * place: a time row's `schedule.slots.1.time` (or `schedule.slots.1`) is
 * `schedule.times.<row>` and its amount `schedule.times.<row>.amount`; a
 * pass's amount is `schedule.passes.<passId>.amount`, anything else about a
 * pass `schedule.passes`; and the whole list's (`schedule.slots`: none, too
 * many, one twice) is `schedule.times`. Others are left as they are.
 */
export const issuesForSlotRows = (issues: FieldIssue[], slotRows: SlotRow[]): FieldIssue[] =>
  issues.map((issue) => {
    if (issue.path === "schedule.slots") return { ...issue, path: "schedule.times" };
    const match = /^schedule\.slots\.(\d+)(?:\.(time|amount|passId))?$/.exec(issue.path);
    const row = match ? slotRows[Number(match[1])] : undefined;
    if (!match || !row) return issue;
    const amount = match[2] === "amount";
    if ("pass" in row)
      return { ...issue, path: amount ? `schedule.passes.${row.pass}.amount` : "schedule.passes" };
    return { ...issue, path: `schedule.times.${row.time}${amount ? ".amount" : ""}` };
  });

/** The fields the form shows issues on; an issue on anything else is shown above the buttons. */
const SHOWN = new Set([
  "name",
  "type",
  "strength",
  "form",
  "dose",
  "directions",
  "reason",
  "schedule",
  "schedule.times",
  "schedule.passes",
  "schedule.maxPerDay",
  "startedOn",
  "prescriberId",
  "pharmacyId",
  "lastFilledOn",
  "quantity",
  "refillsLeft",
  "rxNumber",
  "conditionIds",
]);

/** Whether the form shows this issue on a field (a time row's or a pass's own issue included). */
export const isFieldIssue = (path: string) =>
  SHOWN.has(path) || /^schedule\.(times\.\d+|passes\.[^.]+)(\.amount)?$/.test(path);

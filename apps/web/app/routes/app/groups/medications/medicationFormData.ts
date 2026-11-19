import type { MedicationForm, MedicationSchedule } from "@caretook/data/schema";
import type { FieldIssue } from "../../../../lib/api";
import type { NewMedicationProviders } from "../../../../lib/sync/medications";

import { MEDICATION_FORMS } from "@caretook/data/schema";

// The medication sheet's form as a medication: the fields `MedicationForm`
// posts, read into the shape the device writes (`createMedication`,
// `updateMedication`) validate. The status fields aren't on the form (the
// status actions change them). Pure, so web:unit tests it.

/** The form's field names. */
export const FIELD = {
  name: "name",
  strength: "strength",
  form: "form",
  dose: "dose",
  directions: "directions",
  reason: "reason",
  scheduleType: "scheduleType",
  time: "time",
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
} as const;

/** What the form edits: every content field but the status ones. */
export type MedicationFormInput = {
  name: string;
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
  /** For each time sent, its row in the form (blank rows are left out). */
  timeRows: number[];
};

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

/**
 * The medication in a submitted form. Blank time rows are dropped; a
 * scheduled medication's times, or an as-needed one's maximum, are read by
 * the chosen schedule type. A new prescriber's or pharmacy's name replaces
 * a chosen one. Validation is the write's (the shared Zod schema), so this
 * never refuses anything.
 */
export const medicationFromForm = (form: FormData): MedicationFormData => {
  const times: string[] = [];
  const timeRows: number[] = [];
  form.getAll(FIELD.time).forEach((value, row) => {
    const time = typeof value === "string" ? value.trim() : "";
    if (!time) return;
    times.push(time);
    timeRows.push(row);
  });
  const maxPerDay = number(form, FIELD.maxPerDay);
  const schedule: MedicationSchedule =
    text(form, FIELD.scheduleType) === "asNeeded"
      ? maxPerDay === null
        ? { type: "asNeeded" }
        : { type: "asNeeded", maxPerDay }
      : { type: "scheduled", slots: times.map((time) => ({ time })) };

  const newPrescriber = text(form, FIELD.newPrescriber).trim();
  const newPharmacy = text(form, FIELD.newPharmacy).trim();
  const newProviders: NewMedicationProviders = {
    ...(newPrescriber && { prescriber: newPrescriber }),
    ...(newPharmacy && { pharmacy: newPharmacy }),
  };
  const rawForm = text(form, FIELD.form);

  return {
    input: {
      name: text(form, FIELD.name),
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
    timeRows,
  };
};

/**
 * Issues on sent times moved to the form's rows, so they show on the right
 * field: the schedule's `schedule.slots.1.time` (or `schedule.slots.1`) is
 * row `schedule.times.<row>`, and `schedule.slots` is `schedule.times`.
 * Others are left as they are.
 */
export const issuesForTimeRows = (issues: FieldIssue[], timeRows: number[]): FieldIssue[] =>
  issues.map((issue) => {
    if (issue.path === "schedule.slots") return { ...issue, path: "schedule.times" };
    const match = /^schedule\.(?:times|slots)\.(\d+)(?:\.time)?$/.exec(issue.path);
    if (!match) return issue;
    const row = timeRows[Number(match[1])];
    return row === undefined ? issue : { ...issue, path: `schedule.times.${row}` };
  });

/** The fields the form shows issues on; an issue on anything else is shown above the buttons. */
const SHOWN = new Set([
  "name",
  "strength",
  "form",
  "dose",
  "directions",
  "reason",
  "schedule",
  "schedule.times",
  "schedule.maxPerDay",
  "startedOn",
  "prescriberId",
  "pharmacyId",
  "lastFilledOn",
  "quantity",
  "refillsLeft",
  "rxNumber",
]);

/** Whether the form shows this issue on a field (a time row's own issue included). */
export const isFieldIssue = (path: string) => SHOWN.has(path) || /^schedule\.times\.\d+$/.test(path);

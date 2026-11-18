import type { ProviderContentInput, ProviderType } from "@caretook/data/schema";
import type { FieldIssue } from "../../../../lib/api";

import { isPracticeType, PROVIDER_TYPES } from "@caretook/data/schema";

// The provider sheet's form as a provider: the fields `ProviderForm` posts,
// read into the shape the device writes (`createProvider`, `updateProvider`)
// validate. Pure, so web:unit tests it.

/** The form's field names. */
export const FIELD = {
  type: "type",
  name: "name",
  specialty: "specialty",
  practiceId: "practiceId",
  phoneLabel: "phoneLabel",
  phoneNumber: "phoneNumber",
  email: "email",
  address: "address",
  website: "website",
  isPrimary: "isPrimary",
  past: "past",
} as const;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
const texts = (form: FormData, name: string) =>
  form.getAll(name).map((value) => (typeof value === "string" ? value : ""));

const isProviderType = (value: string): value is ProviderType =>
  (PROVIDER_TYPES as readonly string[]).includes(value);

/** Whether a type can say which practice it works at (practices and pharmacies can't). */
export const hasPractice = (type: ProviderType) => !isPracticeType(type);

export type ProviderFormData = {
  input: ProviderContentInput;
  /** For each phone sent, its row in the form (blank rows are left out). */
  phoneRows: number[];
};

/**
 * The provider in a submitted form. Blank phone rows (no label, no number)
 * are dropped; a practice is only read for types that have one. Validation
 * is the write's (the shared Zod schema), so this never refuses anything.
 */
export const providerFromForm = (form: FormData): ProviderFormData => {
  const rawType = text(form, FIELD.type);
  const type: ProviderType = isProviderType(rawType) ? rawType : "clinician";
  const labels = texts(form, FIELD.phoneLabel);
  const numbers = texts(form, FIELD.phoneNumber);
  const phones: { label: string; number: string }[] = [];
  const phoneRows: number[] = [];
  numbers.forEach((number, row) => {
    const label = labels[row] ?? "";
    if (!label.trim() && !number.trim()) return;
    phones.push({ label, number });
    phoneRows.push(row);
  });
  const practiceId = hasPractice(type) ? text(form, FIELD.practiceId) : "";
  return {
    input: {
      type,
      name: text(form, FIELD.name),
      specialty: text(form, FIELD.specialty),
      practiceId: practiceId || null,
      phones,
      email: text(form, FIELD.email),
      address: text(form, FIELD.address),
      website: text(form, FIELD.website),
      status: form.get(FIELD.past) ? "past" : "current",
      isPrimary: !!form.get(FIELD.isPrimary),
    },
    phoneRows,
  };
};

/** Issues on sent phones (`phones.1.number`) moved to the form's rows, so they show on the right field. */
export const issuesForRows = (issues: FieldIssue[], phoneRows: number[]): FieldIssue[] =>
  issues.map((issue) => {
    const match = /^phones\.(\d+)(\..*)?$/.exec(issue.path);
    if (!match) return issue;
    const row = phoneRows[Number(match[1])];
    return row === undefined ? issue : { ...issue, path: `phones.${row}${match[2] ?? ""}` };
  });

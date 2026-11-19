import type { ContactPhone } from "@caretook/data/schema";
import type { FieldIssue } from "./api";

// Phone numbers and contact details as forms post them (`PhoneFields`, the
// account's Contact details page). Pure, so web:unit tests it; validation is
// the save's (the shared Zod schemas), so nothing here refuses anything.

/** The names `PhoneFields` posts each row's label and number under, in order. */
export const PHONE_FIELD = { label: "phoneLabel", number: "phoneNumber" } as const;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
const texts = (form: FormData, name: string) =>
  form.getAll(name).map((value) => (typeof value === "string" ? value : ""));

export type FormPhones = {
  phones: ContactPhone[];
  /** For each phone sent, its row in the form (blank rows are left out). */
  phoneRows: number[];
};

/** The phone rows in a form, without the blank ones (no label, no number). */
export const phonesFromForm = (form: FormData): FormPhones => {
  const labels = texts(form, PHONE_FIELD.label);
  const numbers = texts(form, PHONE_FIELD.number);
  const phones: ContactPhone[] = [];
  const phoneRows: number[] = [];
  numbers.forEach((number, row) => {
    const label = labels[row] ?? "";
    if (!label.trim() && !number.trim()) return;
    phones.push({ label, number });
    phoneRows.push(row);
  });
  return { phones, phoneRows };
};

/** Issues on sent phones (`phones.1.number`) moved to the form's rows, so they show on the right field. */
export const issuesForRows = (issues: FieldIssue[], phoneRows: number[]): FieldIssue[] =>
  issues.map((issue) => {
    const match = /^phones\.(\d+)(\..*)?$/.exec(issue.path);
    if (!match) return issue;
    const row = phoneRows[Number(match[1])];
    return row === undefined ? issue : { ...issue, path: `phones.${row}${match[2] ?? ""}` };
  });

/** The Contact details page's field names (besides the phones). */
export const CONTACT_FIELD = { contactEmail: "contactEmail", address: "address" } as const;

/** Your contact details in a submitted form, as `me.updateContact` takes them. */
export const contactFromForm = (form: FormData) => {
  const { phones, phoneRows } = phonesFromForm(form);
  return {
    input: {
      phones,
      contactEmail: text(form, CONTACT_FIELD.contactEmail),
      address: text(form, CONTACT_FIELD.address),
    },
    phoneRows,
  };
};

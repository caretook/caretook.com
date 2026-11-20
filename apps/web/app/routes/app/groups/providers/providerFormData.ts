import type { ProviderContentInput, ProviderType } from "@caretook/data/schema";
import { isPracticeType, PROVIDER_TYPES } from "@caretook/data/schema";
import { PHONE_FIELD, phonesFromForm } from "../../../../lib/core/contactForm";

export { issuesForRows } from "../../../../lib/core/contactForm";

// The provider sheet's form as a provider: the fields `ProviderForm` posts,
// read into the shape the device writes (`createProvider`, `updateProvider`)
// validate. Pure, so web:unit tests it.

/** The form's field names. */
export const FIELD = {
  type: "type",
  name: "name",
  specialty: "specialty",
  practiceId: "practiceId",
  phoneLabel: PHONE_FIELD.label,
  phoneNumber: PHONE_FIELD.number,
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
  const { phones, phoneRows } = phonesFromForm(form);
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

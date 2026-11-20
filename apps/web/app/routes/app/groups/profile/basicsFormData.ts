import type { CareRecipientProfileInput } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";

import { careRecipientProfileZSchema, RECIPIENT_LIMITS } from "@caretook/data/schema";

// The Basics sheet's form (`profile/basics`): what it posts, turned into a
// valid change for `careGroup.updateRecipient`, or an error on each field
// that's wrong. Pure, so web:unit tests it. The server checks the same
// shared schema and stays the authority.

/** The form's fields, in the order the sheet shows them. */
export const BASICS_FIELDS = [
  "name",
  "preferredName",
  "dateOfBirth",
  "codeStatus",
  "bloodType",
  "primaryLanguage",
  "pronouns",
  "notes",
] as const;
export type BasicsField = (typeof BASICS_FIELDS)[number];

export type BasicsValues = Record<BasicsField, string>;
export type BasicsChange = Required<Pick<CareRecipientProfileInput, BasicsField>>;

type Failure = Extract<ActionResult, { ok: false }>;
export type ParsedBasics = { ok: true; data: BasicsChange } | Failure;

const LIMITS: Partial<Record<BasicsField, number>> = RECIPIENT_LIMITS;

/** What each field's error says (the schema's own messages aren't written for people). */
const fieldMessage = (field: BasicsField, value: string) => {
  if (field === "name" && !value.trim()) return "Enter a name.";
  if (field === "dateOfBirth") return "Enter a valid date.";
  if (field === "codeStatus" || field === "bloodType") return "Choose one of the options.";
  return `Use ${LIMITS[field] ?? 120} characters or fewer.`;
};

const isField = (value: string): value is BasicsField => (BASICS_FIELDS as readonly string[]).includes(value);

/** Empty text (after trimming) is "none": it clears the field. */
const orNull = (value: string) => value.trim() || null;

/**
 * A submitted Basics form. Every field is sent: an empty preferred name,
 * birthday, basic or note clears it; an empty name, a date that isn't one,
 * an unknown code status or blood type, or text over its limit is an error
 * on that field.
 */
export const parseBasics = (values: BasicsValues): ParsedBasics => {
  const parsed = careRecipientProfileZSchema.safeParse({
    name: values.name,
    preferredName: orNull(values.preferredName),
    dateOfBirth: orNull(values.dateOfBirth),
    codeStatus: orNull(values.codeStatus),
    bloodType: orNull(values.bloodType),
    primaryLanguage: orNull(values.primaryLanguage),
    pronouns: orNull(values.pronouns),
    notes: orNull(values.notes),
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "")))].filter(
      isField,
    );
    return {
      ok: false,
      error: "Check the highlighted fields.",
      issues: fields.map((path) => ({ path, message: fieldMessage(path, values[path]) })),
    };
  }
  const d = parsed.data;
  return {
    ok: true,
    data: {
      name: d.name ?? "",
      preferredName: d.preferredName ?? null,
      dateOfBirth: d.dateOfBirth ?? null,
      codeStatus: d.codeStatus ?? null,
      bloodType: d.bloodType ?? null,
      primaryLanguage: d.primaryLanguage ?? null,
      pronouns: d.pronouns ?? null,
      notes: d.notes ?? null,
    },
  };
};

/** The form's values from a posted form (a missing field is empty). */
export const basicsValues = (form: FormData): BasicsValues => {
  const read = (name: BasicsField) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return Object.fromEntries(BASICS_FIELDS.map((field) => [field, read(field)])) as BasicsValues;
};

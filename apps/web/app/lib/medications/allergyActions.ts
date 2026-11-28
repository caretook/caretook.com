import type { AllergySeverity } from "@caretook/data/schema";

import { ALLERGY_SEVERITIES } from "@caretook/data/schema";
import { formString } from "../core/form";

// The allergies sheet's posts, read from the form: add, edit, remove, and
// "No known allergies" on or off (also the profile's Allergies section's).
// Pure; web:unit tests it.

export const ALLERGY_FIELD = {
  intent: "intent",
  allergyId: "allergyId",
  substance: "substance",
  reaction: "reaction",
  severity: "severity",
  on: "on",
} as const;

export type AllergyAction =
  | { intent: "create"; substance: string; reaction: string; severity: AllergySeverity }
  | { intent: "update"; allergyId: string; substance: string; reaction: string; severity: AllergySeverity }
  | { intent: "remove"; allergyId: string }
  | { intent: "noKnown"; on: boolean };

const severityOf = (value: string): AllergySeverity =>
  (ALLERGY_SEVERITIES as readonly string[]).includes(value) ? (value as AllergySeverity) : "unknown";

/** What a post asks for, or null when it's not one of the sheet's. */
export const allergyActionFromForm = (form: FormData): AllergyAction | null => {
  const intent = formString(form, ALLERGY_FIELD.intent);
  const allergyId = formString(form, ALLERGY_FIELD.allergyId);
  const content = {
    substance: formString(form, ALLERGY_FIELD.substance),
    reaction: formString(form, ALLERGY_FIELD.reaction),
    severity: severityOf(formString(form, ALLERGY_FIELD.severity)),
  };
  if (intent === "create") return { intent, ...content };
  if (intent === "noKnown") return { intent, on: formString(form, ALLERGY_FIELD.on) === "1" };
  if (!allergyId) return null;
  if (intent === "update") return { intent, allergyId, ...content };
  if (intent === "remove") return { intent, allergyId };
  return null;
};

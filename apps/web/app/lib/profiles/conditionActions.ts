import type { ConditionStatus } from "@caretook/data/schema";

import { CONDITION_STATUSES } from "@caretook/data/schema";
import { formString } from "../core/form";

// The condition sheets' posts, read from the form: add, edit, resolve,
// reactivate, delete, and the profile card's "No known conditions" on or
// off. Pure; web:unit tests it. Each route handles only its own intents.

export const CONDITION_FIELD = {
  intent: "intent",
  conditionId: "conditionId",
  name: "name",
  status: "status",
  sinceYear: "sinceYear",
  sinceMonth: "sinceMonth",
  note: "note",
  on: "on",
  // Who diagnosed it and who manages it (slice 3): ids, or names to add.
  diagnosedById: "diagnosedById",
  newDiagnosedBy: "newDiagnosedBy",
  managerId: "managerId",
  newManager: "newManager",
  /** Present when the form has the managers picker (so none chosen means none). */
  managers: "managers",
} as const;

export type ConditionContentFields = {
  name: string;
  /** A whole year, null when blank, NaN when it isn't a number (the schema refuses it on its field). */
  sinceYear: number | null;
  sinceMonth: number | null;
  note: string;
  diagnosedById: string | null;
};

/** Who manages it, and providers to add with the save (conditions.sync's `ConditionProviders`). */
export type ConditionProviderFields = {
  /** Left out when the form had no managers picker. */
  managerIds?: string[];
  newDiagnosedBy?: string;
  newManagers: string[];
};

export type ConditionAction =
  | ({
      intent: "create";
      status: ConditionStatus;
      providers: ConditionProviderFields;
    } & ConditionContentFields)
  | ({ intent: "update"; conditionId: string; providers: ConditionProviderFields } & ConditionContentFields)
  | { intent: "resolve" | "reactivate" | "remove"; conditionId: string }
  | { intent: "noKnownConditions"; on: boolean };

/** "" is none; digits are the number; anything else is NaN, for the schema to refuse with its message. */
const wholeNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};

const statusOf = (value: string): ConditionStatus =>
  (CONDITION_STATUSES as readonly string[]).includes(value) ? (value as ConditionStatus) : "active";

/** What a post asks for, or null when it's not one of the sheets'. */
export const conditionActionFromForm = (form: FormData): ConditionAction | null => {
  const intent = formString(form, CONDITION_FIELD.intent);
  const conditionId = formString(form, CONDITION_FIELD.conditionId);
  const content: ConditionContentFields = {
    name: formString(form, CONDITION_FIELD.name),
    sinceYear: wholeNumber(formString(form, CONDITION_FIELD.sinceYear)),
    sinceMonth: wholeNumber(formString(form, CONDITION_FIELD.sinceMonth)),
    note: formString(form, CONDITION_FIELD.note),
    diagnosedById: formString(form, CONDITION_FIELD.diagnosedById).trim() || null,
  };
  const newDiagnosedBy = formString(form, CONDITION_FIELD.newDiagnosedBy).trim();
  const list = (key: string) =>
    form
      .getAll(key)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
  const providers: ConditionProviderFields = {
    ...(form.has(CONDITION_FIELD.managers) && { managerIds: list(CONDITION_FIELD.managerId) }),
    ...(newDiagnosedBy && { newDiagnosedBy }),
    newManagers: list(CONDITION_FIELD.newManager),
  };
  if (intent === "create")
    return { intent, status: statusOf(formString(form, CONDITION_FIELD.status)), ...content, providers };
  if (intent === "noKnownConditions") return { intent, on: formString(form, CONDITION_FIELD.on) === "1" };
  if (!conditionId) return null;
  if (intent === "update") return { intent, conditionId, ...content, providers };
  if (intent === "resolve" || intent === "reactivate" || intent === "remove") return { intent, conditionId };
  return null;
};

import type { MedicationStopReason } from "@caretook/data/schema";
import type { MedicationStatusChange } from "./medications.sync";

import { MEDICATION_STOP_REASONS } from "@caretook/data/schema";

// The status actions' form (Mark completed, Discontinue, Restart, Delete),
// as the medication page and the edit sheet post it: which write it asks
// for. Pure, so web:unit tests it; the routes' actions make the write
// (`changeMedicationStatus`, `removeMedication`), whose shared Zod rules
// give the messages (a discontinue with no reason is refused there).

export const STATUS_INTENTS = ["complete", "discontinue", "restart", "remove"] as const;
export type StatusIntent = (typeof STATUS_INTENTS)[number];

/** The status form's field names. */
export const STATUS_FIELD = {
  intent: "intent",
  stopReason: "stopReason",
  stopNote: "stopNote",
  stoppedOn: "stoppedOn",
} as const;

export type StatusRequest = { intent: "remove" } | { intent: "status"; change: MedicationStatusChange };

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const isStopReason = (value: string): value is MedicationStopReason =>
  (MEDICATION_STOP_REASONS as readonly string[]).includes(value);

export const isStatusIntent = (value: unknown): value is StatusIntent =>
  (STATUS_INTENTS as readonly unknown[]).includes(value);

/**
 * The write a status form asks for, or null when it isn't one (the edit
 * form's own save). An empty stop date means today (in the recipient's
 * zone, the write's default), an empty note none; an unknown reason is no
 * reason, which the write refuses with its message.
 */
export const statusRequestFromForm = (form: FormData): StatusRequest | null => {
  const intent = text(form, STATUS_FIELD.intent);
  if (!isStatusIntent(intent)) return null;
  if (intent === "remove") return { intent: "remove" };
  if (intent === "restart") return { intent: "status", change: { status: "current" } };
  const stoppedOn = text(form, STATUS_FIELD.stoppedOn) || undefined;
  const stopNote = text(form, STATUS_FIELD.stopNote) || null;
  if (intent === "complete")
    return { intent: "status", change: { status: "completed", stoppedOn, stopNote } };
  const reason = text(form, STATUS_FIELD.stopReason);
  return {
    intent: "status",
    change: { status: "discontinued", stopReason: isStopReason(reason) ? reason : null, stoppedOn, stopNote },
  };
};

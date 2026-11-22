import type { DoseStatus } from "@caretook/data/schema";
import type { DosePatch } from "../../../../../lib/medications/medications.sync";
import type { PassLogJoin } from "../../../../../lib/medications/passLogs.sync";
import type { SheetDecision } from "../sheetGuard";

import { appUrls } from "../../../../../lib/app-shell/appUrls";
import { withoutSheetParams } from "../../../../../lib/timeline/urls";
import { formString } from "../../../../../lib/core/form";
import { parseOccurredAt } from "../entryFormData";

// The pass sheet (`timeline/pass/:passLogId/edit`): who may open it, what
// its form posts, and what a dose added to the log takes from it. Pure, so
// web:unit tests it; the route applies it.

/**
 * A log with at least one dose still there, for someone who may change its
 * doses (writers any, an Easy helper their own). Anyone else, or a log
 * that's missing or fully deleted, is the timeline (filters kept, other
 * sheets' parameters dropped).
 */
export const passSheetGuard = ({
  groupId,
  passLogId,
  liveDoses,
  search,
  canChange,
}: {
  groupId: string;
  passLogId: string;
  /** How many of the log's doses are on the device and not deleted. */
  liveDoses: number;
  search: string;
  /** Whether you may change the log's doses (`canChangeEntry`). */
  canChange: boolean;
}): SheetDecision<{ passLogId: string }> => {
  if (!canChange || liveDoses === 0)
    return { redirect: appUrls.timeline(groupId, withoutSheetParams(search)) };
  return { sheet: { passLogId } };
};

/** The form's fields for one dose: `status:<id>`, `amount:<id>`, `note:<id>`, `occurredAt:<id>`. */
export const doseField = (field: "status" | "amount" | "note" | "occurredAt", doseId: string) =>
  `${field}:${doseId}`;

/** The hidden field listing the doses the form shows. */
export const DOSE_IDS_FIELD = "dose";

const optional = (value: string) => value.trim() || null;

/**
 * The Save's patches, one per dose the form showed: status, amount, note
 * and time. A blank amount or note clears it; an unreadable time is "" (the
 * write refuses it).
 */
export const passLogPatchesFromForm = (form: FormData): { id: string; patch: DosePatch }[] =>
  form
    .getAll(DOSE_IDS_FIELD)
    .filter((id): id is string => typeof id === "string" && !!id)
    .map((id) => ({
      id,
      patch: {
        status: formString(form, doseField("status", id)) as DoseStatus,
        amount: optional(formString(form, doseField("amount", id))),
        note: optional(formString(form, doseField("note", id))),
        occurredAt: parseOccurredAt(formString(form, doseField("occurredAt", id))),
      },
    }));

type LoggedDose = {
  occurredAt: string;
  details: { passLogId?: string | null; passId?: string | null; scheduledFor?: string | null };
};

/**
 * What a medication added to the log takes from it: the round, the pass and
 * the slot's time (from the first dose that has them), and its earliest
 * dose's time, so the added dose sits with the rest.
 */
export const passLogJoin = (passLogId: string, doses: readonly LoggedDose[]): PassLogJoin | null => {
  if (!doses.length) return null;
  const earliest = [...doses].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0]!;
  return {
    passLogId,
    passId: doses.map((d) => d.details.passId).find((id) => !!id) ?? null,
    scheduledFor: doses.map((d) => d.details.scheduledFor).find((t) => !!t) ?? null,
    occurredAt: earliest.occurredAt,
  };
};

/** The medications "Add a medication" offers: current ones not in the log already, in the given order. */
export const addableMedications = <Choice extends { id: string }>(
  choices: readonly Choice[],
  doses: readonly { details: { medicationId: string } }[],
) => {
  const logged = new Set(doses.map((d) => d.details.medicationId));
  return choices.filter((c) => !logged.has(c.id));
};

import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { StatusIntent } from "~/lib/medicationStatusForm";
import type { MedicationRow, RecipientRow } from "~/lib/sync/medications";

import { useCallback, useEffect } from "react";
import { redirect } from "react-router";
import { MedicationStatusActions } from "~/components/medications";
import { Sheet } from "~/components/ui";
import { getGroup } from "~/lib/group";
import { medicationTitle, scheduleZoneNote } from "~/lib/medicationDisplay";
import { editMedicationGuard } from "~/lib/medicationSheets";
import { statusRequestFromForm } from "~/lib/medicationStatusForm";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import {
  changeMedicationStatus,
  medicationQuery,
  recipientQuery,
  removeMedication,
  toMedication,
  updateMedication,
} from "~/lib/sync/medications";
import { readRows } from "~/lib/sync/timeline";
import { MedicationForm } from "../MedicationForm";
import { issuesForTimeRows, medicationFromForm } from "../medicationFormData";
import { loadFormSources, useCloseMedicationSheet, useMedicationFormSources } from "../medicationSheet";

// Shared by web + native. `medications/:medicationId/edit`: the edit sheet,
// over the list (opened from the list or from the medication's page, which
// it goes back to), with the status actions (Mark completed, Discontinue,
// Restart) and Delete. A viewer, and a medication that's missing, deleted or
// in another group, land on the list.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const medicationRows = await readRows<MedicationRow>(db, medicationQuery(params.medicationId));
  const decision = editMedicationGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    medication: medicationRows[0] ? toMedication(medicationRows[0]) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const [sources, [recipient]] = await Promise.all([
    loadFormSources(db, group.id),
    readRows<RecipientRow>(db, recipientQuery(group.id)),
  ]);
  return {
    medication: decision.sheet,
    medicationRows,
    ...sources,
    recipientTimeZone: recipient?.time_zone ?? null,
  };
}

/**
 * Local writes: the edit (with its change entry, when a tracked field
 * changed), a status action, or Delete. The list's live query shows them,
 * and PowerSync uploads them.
 */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const status = statusRequestFromForm(form);
  if (status?.intent === "remove") return removeMedication(db, params.medicationId);
  if (status) return changeMedicationStatus(db, params.medicationId, status.change);
  const { input, newProviders, timeRows } = medicationFromForm(form);
  const result = await updateMedication(db, params.medicationId, input, newProviders);
  if (!result.ok) return { ...result, issues: issuesForTimeRows(result.issues, timeRows) };
  return { ok: true };
}

/**
 * The sheet closes on a save or a delete, so its loader doesn't run again
 * (after a delete it would find the medication gone and redirect as well).
 */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditMedicationSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseMedicationSheet();
  const { providers, names } = useMedicationFormSources(params.groupId, loaderData);

  // Live, so the status shown follows a change made here or on another device.
  const query = medicationQuery(params.medicationId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.medicationRows);
  const live = rows[0] ? toMedication(rows[0]) : null;
  const gone = !live || !!live.deletedAt;
  const medication = live && !gone ? live : loaderData.medication;

  // Deleted (here or elsewhere): the page it may have come from is gone too, so the list.
  useEffect(() => {
    if (gone) close(true);
  }, [gone, close]);

  // A status change is a save of its own: the sheet closes, back where it came from.
  const statusDone = useCallback((intent: StatusIntent) => close(intent === "remove"), [close]);

  const zoneNote = scheduleZoneNote(
    loaderData.recipientTimeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  return (
    <Sheet
      isOpen
      onOpenChange={(open) => !open && close()}
      title={`Edit ${medicationTitle(loaderData.medication)}`}
    >
      <MedicationForm
        key={loaderData.medication.id}
        medication={loaderData.medication}
        providers={providers}
        names={names}
        zoneNote={zoneNote}
        onDone={() => close()}
        onCancel={() => close()}
      />
      <div className="border-base-300 mt-4 border-t pt-4">
        <MedicationStatusActions
          medication={medication}
          recipientTimeZone={loaderData.recipientTimeZone}
          layout="buttons"
          onDone={statusDone}
        />
      </div>
    </Sheet>
  );
}

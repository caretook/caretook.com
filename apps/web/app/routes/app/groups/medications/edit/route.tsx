import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { StatusIntent } from "~/lib/medications/medicationStatusForm";
import type { MedicationRow, RecipientRow } from "~/lib/medications/medications.sync";

import { useCallback, useEffect } from "react";
import { redirect } from "react-router";
import { MedicationStatusActions } from "~/components/medications";
import { Sheet } from "~/components/ui";
import { getGroup } from "~/lib/app-shell/group";
import { medicationTitle, scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { editMedicationGuard, sheetTab } from "~/lib/medications/medicationSheets";
import { statusRequestFromForm } from "~/lib/medications/medicationStatusForm";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import {
  changeMedicationStatus,
  medicationQuery,
  recipientQuery,
  removeMedication,
  toMedication,
  updateMedication,
} from "~/lib/medications/medications.sync";
import {
  checkMedicationConditions,
  loadMedicationConditions,
  setMedicationConditions,
} from "~/lib/profiles/medicationConditions.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { MedicationForm } from "../MedicationForm";
import { issuesForSlotRows, medicationFromForm } from "../medicationFormData";
import { loadFormSources, useCloseMedicationSheet, useMedicationFormSources } from "../medicationSheet";

// Shared by web + native. `medications/<tab>/:medicationId/edit`: the edit
// sheet, over Schedule or the list (opened from a tab or from the
// medication's page, over the list, which it goes back to), with the status
// actions (Mark completed, Discontinue, Restart) and Delete. A viewer, and a
// medication that's missing, deleted or in another group, land on the tab.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const medicationRows = await readRows<MedicationRow>(db, medicationQuery(params.medicationId));
  const url = new URL(request.url);
  const decision = editMedicationGuard({
    groupId: group.id,
    tab: sheetTab(group.id, url.pathname),
    search: url.search,
    canWrite: group.canWrite,
    medication: medicationRows[0] ? toMedication(medicationRows[0]) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const [sources, [recipient], linked] = await Promise.all([
    loadFormSources(db, group.id),
    readRows<RecipientRow>(db, recipientQuery(group.id)),
    loadMedicationConditions(db, params.medicationId),
  ]);
  return {
    medication: decision.sheet,
    medicationRows,
    ...sources,
    // What it's for as the sheet opens (the For field's chips).
    conditionIds: linked.map((c) => c.id),
    recipientTimeZone: recipient?.time_zone ?? null,
  };
}

/**
 * Local writes: the edit (with its change entry, when a tracked field
 * changed) and the conditions it's for (checked first, so a refusal saves
 * nothing), a status action, or Delete. The list's live query shows them,
 * and PowerSync uploads them.
 */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const status = statusRequestFromForm(form);
  if (status?.intent === "remove") return removeMedication(db, params.medicationId);
  if (status) return changeMedicationStatus(db, params.medicationId, status.change);
  const { input, newProviders, slotRows, conditionIds } = medicationFromForm(form);
  const badConditions = await checkMedicationConditions(db, group.id, conditionIds);
  if (badConditions) return badConditions;
  const result = await updateMedication(db, params.medicationId, input, newProviders, {
    requireType: true,
  });
  if (!result.ok) return { ...result, issues: issuesForSlotRows(result.issues, slotRows) };
  return setMedicationConditions(db, params.medicationId, conditionIds);
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
  const { providers, names, passes, conditions } = useMedicationFormSources(params.groupId, loaderData);

  // Live, so the status shown follows a change made here or on another device.
  const query = medicationQuery(params.medicationId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.medicationRows);
  const live = rows[0] ? toMedication(rows[0]) : null;
  const gone = !live || !!live.deletedAt;
  const medication = live && !gone ? live : loaderData.medication;

  // Deleted (here or elsewhere): the page it may have come from is gone too, so the tab underneath.
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
      guardChanges={!gone}
      isOpen
      onOpenChange={(open) => !open && close()}
      title={`Edit ${medicationTitle(loaderData.medication)}`}
    >
      <MedicationForm
        key={loaderData.medication.id}
        medication={loaderData.medication}
        providers={providers}
        passes={passes}
        names={names}
        conditions={conditions}
        conditionIds={loaderData.conditionIds}
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

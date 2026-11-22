import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { RecipientRow } from "~/lib/medications/medications.sync";

import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { newMedicationGuard, sheetTab } from "~/lib/medications/medicationSheets";
import { sessionContext } from "~/lib/auth/session";
import { createMedication, recipientQuery } from "~/lib/medications/medications.sync";
import { checkMedicationConditions, setMedicationConditions } from "~/lib/profiles/medicationConditions.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { MedicationForm } from "../MedicationForm";
import { issuesForSlotRows, medicationFromForm } from "../medicationFormData";
import { loadFormSources, useCloseMedicationSheet, useMedicationFormSources } from "../medicationSheet";

// Shared by web + native. `medications/<tab>/new`: the add sheet, over
// Schedule or the list. A viewer lands on the tab.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const url = new URL(request.url);
  const decision = newMedicationGuard({
    groupId: group.id,
    tab: sheetTab(group.id, url.pathname),
    search: url.search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  const [sources, [recipient]] = await Promise.all([
    loadFormSources(db, group.id),
    readRows<RecipientRow>(db, recipientQuery(group.id)),
  ]);
  return { ...sources, recipientTimeZone: recipient?.time_zone ?? null };
}

/**
 * A local write (the medication, its "Started" entry, and a prescriber or
 * pharmacy added with it, in one transaction), then the conditions it's for
 * (checked first, so a refusal saves nothing); the tabs' live queries show
 * it, and PowerSync uploads it.
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newProviders, slotRows, conditionIds } = medicationFromForm(await request.formData());
  const badConditions = await checkMedicationConditions(db, group.id, conditionIds);
  if (badConditions) return badConditions;
  const result = await createMedication(db, group.id, input, newProviders, { requireType: true });
  if (!result.ok) return { ...result, issues: issuesForSlotRows(result.issues, slotRows) };
  if (conditionIds.length) return setMedicationConditions(db, result.id, conditionIds);
  return { ok: true };
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewMedicationSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseMedicationSheet();
  const { search } = useLocation();
  const { providers, names, passes, conditions } = useMedicationFormSources(params.groupId, loaderData);
  const zoneNote = scheduleZoneNote(
    loaderData.recipientTimeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Add a medication">
      <MedicationForm
        // A new URL is a new form.
        key={search}
        providers={providers}
        passes={passes}
        names={names}
        conditions={conditions}
        zoneNote={zoneNote}
        onDone={() => close()}
        onCancel={() => close()}
      />
    </Sheet>
  );
}

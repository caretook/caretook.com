import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CreateResult } from "~/lib/core/api";
import type { RecipientRow } from "~/lib/medications/medications.sync";

import { useCallback } from "react";
import { redirect, useLocation, useNavigate } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { medicationPageState } from "~/lib/medications/medicationOrigin";
import { newMedicationGuard, sheetTab } from "~/lib/medications/medicationSheets";
import { sessionContext } from "~/lib/auth/session";
import { createMedication, recipientQuery } from "~/lib/medications/medications.sync";
import { checkMedicationConditions, setMedicationConditions } from "~/lib/profiles/medicationConditions.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { MedicationForm } from "../MedicationForm";
import { issuesForSlotRows, medicationFromForm } from "../medicationFormData";
import { loadFormSources, useCloseMedicationSheet, useMedicationFormSources } from "../medicationSheet";

// Shared by web + native. `medications/<tab>/new`: the add sheet, over
// Schedule or the list. A viewer lands on the tab. A save opens the new
// medication's page in the sheet's place, so Back goes to the tab, not the
// form; Cancel, Escape and a tap outside close as any medication sheet does.

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
 * (checked first, so a refusal saves nothing). Local, so its page finds it
 * at once; PowerSync uploads it. Once the medication is written the save
 * counts: a conditions refusal after it (only a race: checked just before)
 * still opens the page, which shows what it's for, rather than invite a
 * second save of the same medication.
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<CreateResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newProviders, slotRows, conditionIds } = medicationFromForm(await request.formData());
  const badConditions = await checkMedicationConditions(db, group.id, conditionIds);
  if (badConditions) return badConditions;
  const result = await createMedication(db, group.id, input, newProviders, { requireType: true });
  if (!result.ok) return { ...result, issues: issuesForSlotRows(result.issues, slotRows) };
  if (conditionIds.length) await setMedicationConditions(db, result.id, conditionIds);
  return { ok: true, id: result.id };
}

/** The sheet leaves on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewMedicationSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseMedicationSheet();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { groupId } = params;
  // The page replaces the sheet's entry; its Back link names the tab underneath, with its search.
  const opened = useCallback(
    (id?: string) => {
      if (!id) {
        close();
        return;
      }
      const tab = appUrls.medicationTab(groupId, sheetTab(groupId, pathname), search);
      void navigate(appUrls.medication(groupId, id), { replace: true, state: medicationPageState(tab) });
    },
    [navigate, groupId, pathname, search, close],
  );
  const { providers, names, passes, conditions } = useMedicationFormSources(params.groupId, loaderData);
  const zoneNote = scheduleZoneNote(
    loaderData.recipientTimeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Add a medication">
      <MedicationForm
        // A new URL is a new form.
        key={search}
        providers={providers}
        passes={passes}
        names={names}
        conditions={conditions}
        zoneNote={zoneNote}
        onDone={opened}
        onCancel={() => close()}
      />
    </Sheet>
  );
}

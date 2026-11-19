import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { RecipientRow } from "~/lib/sync/medications";

import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup } from "~/lib/group";
import { scheduleZoneNote } from "~/lib/medicationDisplay";
import { newMedicationGuard } from "~/lib/medicationSheets";
import { sessionContext } from "~/lib/session";
import { createMedication, recipientQuery } from "~/lib/sync/medications";
import { readRows } from "~/lib/sync/timeline";
import { MedicationForm } from "../MedicationForm";
import { issuesForTimeRows, medicationFromForm } from "../medicationFormData";
import { loadFormSources, useCloseMedicationSheet, useMedicationFormSources } from "../medicationSheet";

// Shared by web + native. `medications/new`: the add sheet, over the list.
// A viewer lands on the list.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newMedicationGuard({
    groupId: group.id,
    search: new URL(request.url).search,
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
 * pharmacy added with it, in one transaction); the list's live query shows
 * it, and PowerSync uploads it.
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newProviders, timeRows } = medicationFromForm(await request.formData());
  const result = await createMedication(db, group.id, input, newProviders);
  if (!result.ok) return { ...result, issues: issuesForTimeRows(result.issues, timeRows) };
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
  const { providers, names } = useMedicationFormSources(params.groupId, loaderData);
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
        names={names}
        zoneNote={zoneNote}
        onDone={() => close()}
        onCancel={() => close()}
      />
    </Sheet>
  );
}

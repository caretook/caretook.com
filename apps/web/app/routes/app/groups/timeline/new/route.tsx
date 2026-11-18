import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { redirect, useLocation } from "react-router";
import { formString } from "~/lib/form";
import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { createEntry } from "~/lib/sync/timeline";
import { entryContentFromForm, parseUnits } from "../entryFormData";
import { EntryForm } from "../EntryForm";
import { EntrySheet } from "../EntrySheet";
import { useCloseSheet, useTimelineOutlet } from "../sheet";
import { newSheetGuard } from "../sheetGuard";

// Shared by web + native. `timeline/new/symptom` and `timeline/new/vital`
// (`?type=heartRate` starts with that reading): the add sheet, over the
// timeline. Notes and events have a page instead (`entries/new?kind=`), so
// any other kind, or a viewer, lands on the timeline.

export function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newSheetGuard({
    groupId: group.id,
    kind: params.kind,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return decision.sheet;
}

/** The same local write as before sheets had URLs; live queries show it, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  // The units the form displayed, so vitals convert back the way they were typed.
  const units = parseUnits(formString(form, "units"));
  return createEntry(db, group.id, entryContentFromForm(form, units));
}

export default function NewEntrySheet({ loaderData }: Route.ComponentProps) {
  const { units } = useTimelineOutlet();
  const close = useCloseSheet();
  const { search } = useLocation();
  return (
    <EntrySheet isOpen onOpenChange={(open) => !open && close()} title="Add to the timeline">
      <EntryForm
        // A new URL is a new form (empty, "When" set to now).
        key={`${loaderData.kind}${search}`}
        units={units}
        initialKind={loaderData.kind}
        initialVitalType={loaderData.vitalType ?? undefined}
        onDone={close}
        onCancel={close}
      />
    </EntrySheet>
  );
}

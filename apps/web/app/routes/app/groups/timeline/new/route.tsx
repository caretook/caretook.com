import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";

import { VITALS } from "@caretook/data/schema";
import { redirect, useLocation } from "react-router";
import { startAtFrom } from "~/lib/timeline/urls";
import { formString } from "~/lib/core/form";
import { entryDraftFrom } from "~/lib/assistant/quickEntryDraft";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { createEntry } from "~/lib/timeline/timeline.sync";
import { entryContentFromForm, parseUnits } from "../entryFormData";
import { EntryForm } from "../EntryForm";
import { Sheet } from "~/components/ui";
import { useCloseSheet, useTimelineOutlet } from "../sheet";
import { newSheetGuard } from "../sheetGuard";
import { useRecipientWords } from "../useEasyTiles";
import { feelLabel } from "~/lib/assistant/easyTiles";

// Shared by web + native. `timeline/new/symptom` and `timeline/new/vital`
// (`?type=heartRate` starts with that reading): the add sheet, over the
// timeline (`?at=<ISO>` starts it at that time: a past day's +). Notes and events have a page instead (`entries/new?kind=`), so
// any other kind, or someone who doesn't log care, lands on the timeline. In easy mode (the
// tiles) it's the easy variant: the feelings scale, or one vital type's
// fields, titled in plain words ("How she feels", "Blood pressure").

export function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newSheetGuard({
    groupId: group.id,
    kind: params.kind,
    search: new URL(request.url).search,
    canLog: group.canLog,
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

export default function NewEntrySheet({ loaderData, params }: Route.ComponentProps) {
  const { units, easy } = useTimelineOutlet();
  const words = useRecipientWords(params.groupId);
  const close = useCloseSheet();
  const location = useLocation();
  const { search } = location;
  // Opened from quick entry's Edit: the card's reading, filled in.
  const draft = entryDraftFrom(location.state as unknown);
  const feel = feelLabel(words);
  const title = !easy
    ? "Add to the timeline"
    : loaderData.kind === "symptom"
      ? feel
      : loaderData.vitalType
        ? VITALS[loaderData.vitalType].label
        : "Add a reading";
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title={title}>
      <EntryForm
        // A new URL is a new form (empty, "When" set to now).
        key={`${loaderData.kind}${search}`}
        units={units}
        initialKind={loaderData.kind}
        initialVitalType={loaderData.vitalType ?? undefined}
        initialAt={startAtFrom(search)}
        draft={draft?.kind === loaderData.kind ? draft : null}
        easy={easy ? { feelLabel: feel } : null}
        onDone={close}
        onCancel={close}
      />
    </Sheet>
  );
}

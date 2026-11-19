import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";
import type { DoseChoiceRow } from "~/lib/sync/medicationTimeline";

import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { logDose } from "~/lib/sync/medications";
import { doseChoicesQuery, toDoseChoices } from "~/lib/sync/medicationTimeline";
import { readRows } from "~/lib/sync/timeline";
import { doseFromForm } from "../doseFormData";
import { DoseForm } from "../DoseForm";
import { useCloseSheet } from "../sheet";
import { newDoseGuard } from "../sheetGuard";

// Shared by web + native. `timeline/new/dose` (`?medication=<id>&slot=08:00`
// starts on that medication, for that slot): the Dose sheet, over the
// timeline. It offers the group's current medications, the most recently
// given first. A viewer lands on the timeline.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const choices = toDoseChoices(await readRows<DoseChoiceRow>(db, doseChoicesQuery(params.groupId)));
  const decision = newDoseGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    choiceIds: choices.map((c) => c.id),
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return { choices, ...decision.sheet };
}

/** A local write; live queries show it at once, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await logDose(db, group.id, doseFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

export default function NewDoseSheet({ loaderData }: Route.ComponentProps) {
  const { choices, medicationId, slot } = loaderData;
  const close = useCloseSheet();
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Log a dose">
      {choices.length === 0 ? (
        <div className="space-y-3" data-no-medications>
          <p>There are no current medications to log a dose of.</p>
          <button type="button" className="btn" onClick={close}>
            Close
          </button>
        </div>
      ) : (
        <DoseForm
          // A new URL is a new form (the medication, the slot, "When" set to now).
          key={`${medicationId}-${slot}`}
          choices={choices}
          initialMedicationId={medicationId}
          slot={slot}
          onDone={close}
          onCancel={close}
        />
      )}
    </Sheet>
  );
}

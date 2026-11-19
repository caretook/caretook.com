import type { Route } from "./+types/route";
import type { Marking } from "~/components/medications";
import type { ActionResult } from "~/lib/api";
import type { PlannedDose } from "~/lib/dueDoses";
import type { DoseChoiceRow } from "~/lib/sync/medicationTimeline";

import { useCallback, useMemo, useState } from "react";
import { redirect } from "react-router";
import { MarkDoseDialog, PassCard, PassUndoStatus } from "~/components/medications";
import { Sheet } from "~/components/ui";
import { doseWarnings } from "~/lib/dueDoses";
import { duePasses, isNamedPass, isPassDueNow } from "~/lib/duePasses";
import { getGroup, useGroup } from "~/lib/group";
import { doseWarningText } from "~/lib/medicationDisplay";
import { sessionContext } from "~/lib/session";
import { loadDueDoses, useDueDoses } from "~/lib/sync/dueDoses";
import { logDose } from "~/lib/sync/medications";
import { doseChoicesQuery, toDoseChoices } from "~/lib/sync/medicationTimeline";
import { useMemberNames } from "~/lib/sync/memberNames";
import { readRows } from "~/lib/sync/timeline";
import { doseFromForm, doseSheetOptions } from "../doseFormData";
import { DoseForm } from "../DoseForm";
import { useCloseSheet } from "../sheet";
import { newDoseGuard } from "../sheetGuard";

// Shared by web + native. `timeline/new/dose` (`?medication=<id>&slot=08:00`
// starts on that medication, for that slot): the Dose sheet, over the
// timeline. It shows the passes due now first (`?pass=<id>` puts that one of
// today's passes first, whatever its state), each with Given all and each
// medication's Given, Skipped and Refused; then the form, offering the other
// slots due now, then the group's current medications (the most recently
// given first), and asking before logging a second dose for a slot or one
// past an as-needed maximum. A viewer lands on the timeline.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [choiceRows, due] = await Promise.all([
    readRows<DoseChoiceRow>(db, doseChoicesQuery(params.groupId)),
    loadDueDoses(db, params.groupId),
  ]);
  const choices = toDoseChoices(choiceRows);
  const decision = newDoseGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    choiceIds: choices.map((c) => c.id),
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return { choices, due, ...decision.sheet };
}

/** A local write; live queries show it at once, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await logDose(db, group.id, doseFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

export default function NewDoseSheet({ loaderData, params }: Route.ComponentProps) {
  const { choices, medicationId, slot, passId } = loaderData;
  const close = useCloseSheet();
  const group = useGroup();
  const nameOf = useMemberNames(params.groupId, group.userId);
  const [marking, setMarking] = useState<Marking | null>(null);
  const { due, timeZone, passes } = useDueDoses(params.groupId, loaderData.due);
  // The pass asked for (any state), then the other named passes due now.
  const shown = useMemo(() => {
    const today = duePasses(due, passes).filter(isNamedPass);
    const asked = today.filter((p) => p.passId === passId);
    return [...asked, ...today.filter((p) => p.passId !== passId && isPassDueNow(p))];
  }, [due, passes, passId]);
  const { options, initial } = useMemo(
    () => doseSheetOptions(choices, due, { medicationId, slot }, new Set(shown.map((p) => p.passId))),
    [choices, due, medicationId, slot, shown],
  );
  const warningsFor = useCallback(
    (planned: PlannedDose) => doseWarnings(due, planned, new Date()).map((w) => doseWarningText(w, timeZone)),
    [due, timeZone],
  );
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Log a dose">
      <PassUndoStatus groupId={params.groupId} className="mb-2" />
      {shown.length > 0 && (
        <div className="mb-4 space-y-2" data-dose-passes>
          {shown.map((pass) => (
            <PassCard
              key={pass.key}
              pass={pass}
              groupId={params.groupId}
              timeZone={timeZone}
              canWrite={group.canWrite}
              nameOf={nameOf}
              defaultExpanded
              onMark={(s, status, logId) => setMarking({ slot: s, status, passLogId: logId })}
            />
          ))}
        </div>
      )}
      <MarkDoseDialog marking={marking} groupId={params.groupId} onClose={() => setMarking(null)} />
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
          options={options}
          initialOption={initial}
          warningsFor={warningsFor}
          onDone={close}
          onCancel={close}
        />
      )}
    </Sheet>
  );
}

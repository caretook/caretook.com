import type { Route } from "./+types/route";
import type { Marking } from "~/components/medications";
import type { ActionResult } from "~/lib/core/api";
import type { DoseChoiceRow } from "~/lib/medications/medicationTimeline.sync";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";

import { useCallback, useMemo, useState } from "react";
import { redirect, useLocation } from "react-router";
import { startAtFrom } from "~/lib/timeline/urls";
import { MarkDoseDialog, PassCard, PassUndoStatus } from "~/components/medications";
import { EmptyState, Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { doseDraftFrom } from "~/lib/assistant/quickEntryDraft";
import { sessionContext } from "~/lib/auth/session";
import { loadDueDoses, useDueDoses } from "~/lib/medications/dueDoses.sync";
import { offerAddedNotice } from "~/lib/medications/addedNotice";
import { logDose, logDoseOfNewMedication, medicationNamesQuery } from "~/lib/medications/medications.sync";
import { doseChoicesQuery, toDoseChoices } from "~/lib/medications/medicationTimeline.sync";
import { useMemberNames } from "~/lib/care-groups/memberNames.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { doseFromForm, doseSheetOptions, NEW_MEDICATION_OPTION, quickAddFromForm } from "../doseFormData";
import { DoseForm } from "../DoseForm";
import { doseSheetHome } from "~/lib/medications/medicationSheets";
import { useCloseSheet } from "../sheet";
import { newDoseGuard } from "../sheetGuard";
import type { PlannedDose } from "@caretook/data/schema";
import { doseWarnings, duePasses, isNamedPass, isPassDueNow, doseWarningText } from "@caretook/data/schema";

// Shared by web + native. `timeline/new/dose` (`?medication=<id>&slot=08:00`
// starts on that medication, for that slot; `?at=<ISO>` at that time): the Dose sheet, over the
// timeline. It shows the passes due now first (`?pass=<id>` puts that one of
// today's passes first, whatever its state), each with Given all and each
// medication's Given, Skipped and Refused; then the form, offering the other
// slots due now, then the group's current medications (the most recently
// given first), and asking before logging a second dose for a slot or one
// past an as-needed maximum. Its last choice, "+ New medication", adds a
// medication (name, dose and type) with the dose; with no current
// medications that's the form. A viewer lands on the timeline. The
// Medications list mounts it too (`medications/list/dose`, its Log), over
// the list, which it then closes and sends a viewer back to.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [choiceRows, due, names] = await Promise.all([
    readRows<DoseChoiceRow>(db, doseChoicesQuery(params.groupId)),
    loadDueDoses(db, params.groupId),
    readRows<MedicationNameRow>(db, medicationNamesQuery(params.groupId)),
  ]);
  const choices = toDoseChoices(choiceRows);
  const url = new URL(request.url);
  const decision = newDoseGuard({
    groupId: group.id,
    search: url.search,
    canLog: group.canLog,
    choiceIds: choices.map((c) => c.id),
    home: doseSheetHome(group.id, url.pathname, url.search),
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return { choices, due, names, ...decision.sheet };
}

/**
 * A local write; live queries show it at once, and PowerSync uploads it. A
 * new medication is written with its dose in one transaction, and offers
 * the "Added … · Add details" notice for when the sheet has closed.
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const quickAdd = quickAddFromForm(form);
  if (!quickAdd) {
    const result = await logDose(db, group.id, doseFromForm(form));
    return result.ok ? { ok: true } : result;
  }
  const result = await logDoseOfNewMedication(db, group.id, quickAdd);
  if (!result.ok) return result;
  offerAddedNotice({
    groupId: group.id,
    medicationId: result.id,
    name: quickAdd.medication.name.trim(),
    from: new URL(request.url).pathname,
  });
  return { ok: true };
}

export default function NewDoseSheet({ loaderData, params }: Route.ComponentProps) {
  const { choices, names, medicationId, slot, passId } = loaderData;
  const group = useGroup();
  // Opened from quick entry's Edit: the card's status, amount, note and time, filled in.
  const location = useLocation();
  const close = useCloseSheet(doseSheetHome(params.groupId, location.pathname, location.search));
  const draft = doseDraftFrom(location.state);
  const nameOf = useMemberNames(params.groupId, group.userId);
  const [marking, setMarking] = useState<Marking | null>(null);
  const { due, timeZone, passes } = useDueDoses(params.groupId, loaderData.due);
  // The pass asked for (any state), then the other named passes due now.
  const shown = useMemo(() => {
    const today = duePasses(due, passes).filter(isNamedPass);
    const asked = today.filter((p) => p.passId === passId);
    return [...asked, ...today.filter((p) => p.passId !== passId && isPassDueNow(p))];
  }, [due, passes, passId]);
  const { options, initial } = useMemo(() => {
    const sheet = doseSheetOptions(choices, due, { medicationId, slot }, new Set(shown.map((p) => p.passId)));
    // Only writers add a medication as they log its dose (an Easy helper logs doses of current ones).
    return group.canWrite
      ? sheet
      : { ...sheet, options: sheet.options.filter((o) => o.value !== NEW_MEDICATION_OPTION) };
  }, [choices, due, medicationId, slot, shown, group.canWrite]);
  const warningsFor = useCallback(
    (planned: PlannedDose) => doseWarnings(due, planned, new Date()).map((w) => doseWarningText(w, timeZone)),
    [due, timeZone],
  );
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Log a dose">
      <PassUndoStatus groupId={params.groupId} className="mb-2" />
      {shown.length > 0 && (
        <div className="mb-4 space-y-2" data-dose-passes>
          {shown.map((pass) => (
            <PassCard
              key={pass.key}
              pass={pass}
              groupId={params.groupId}
              timeZone={timeZone}
              canWrite={group.canLog}
              nameOf={nameOf}
              defaultExpanded
              onMark={(s, status, logId) => setMarking({ slot: s, status, passLogId: logId })}
            />
          ))}
        </div>
      )}
      <MarkDoseDialog marking={marking} groupId={params.groupId} onClose={() => setMarking(null)} />
      {choices.length === 0 && (
        <EmptyState className="mb-2" data-no-medications="">
          {group.canWrite
            ? "There are no current medications yet. Add one as you log its dose."
            : "There are no current medications yet."}
        </EmptyState>
      )}
      {options.length > 0 && (
        <DoseForm
          // A new URL is a new form (the medication, the slot, "When" set to now or `?at=`).
          key={`${medicationId}-${slot}`}
          options={options}
          names={names}
          initialOption={initial}
          warningsFor={warningsFor}
          draft={draft}
          initialAt={startAtFrom(location.search)}
          onDone={close}
          onCancel={close}
        />
      )}
    </Sheet>
  );
}

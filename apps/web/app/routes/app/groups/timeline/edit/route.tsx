import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { canChangeEntry } from "@caretook/data/schema";
import { useEffect, useMemo } from "react";
import { redirect } from "react-router";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { formString } from "~/lib/core/form";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { medicationIdOf, medicationLabel } from "~/lib/medications/medicationEntries";
import { useLiveQuery } from "~/lib/sync";
import { medicationQuery, updateDose } from "~/lib/medications/medications.sync";
import { readRows, toTimelineEntry, updateEntry } from "~/lib/timeline/timeline.sync";
import { DoseForm } from "../DoseForm";
import { dosePatchFromForm } from "../doseFormData";
import { entryUpdateFromForm, parseUnits } from "../entryFormData";
import { EntryForm } from "../EntryForm";
import { Sheet } from "~/components/ui";
import { useCloseSheet, useTimelineOutlet } from "../sheet";
import { editSheetGuard } from "../sheetGuard";

// Shared by web + native. `timeline/:entryId/edit`: a symptom's, vital's or
// dose's edit sheet, over the timeline. A note or event goes to its page; a
// medication change, a missing, deleted or other group's entry, or a viewer,
// lands on the timeline.

/** The entry as the device has it, in any group and deleted or not: the guard decides. */
const entrySql = "SELECT * FROM timeline_entry WHERE id = ?";
/** The same entry while the sheet is open: gone means deleted (or moved out of reach). */
const liveEntrySql = "SELECT * FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [row] = await readRows<EntryRow>(db, { sql: entrySql, params: [params.entryId] });
  const entry = row ? toTimelineEntry(row) : null;
  const decision = editSheetGuard({
    groupId: group.id,
    entry,
    search: new URL(request.url).search,
    // Writers change any entry; an Easy helper only their own.
    canChange: !!entry && canChangeEntry({ role: group.role, userId: group.userId, entry }),
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  // A dose names its medication (deleted or not: the dose keeps it).
  const medicationId = medicationIdOf(decision.sheet.entry);
  const [medication] = medicationId ? await readRows<MedicationRow>(db, medicationQuery(medicationId)) : [];
  return {
    ...decision.sheet,
    medicationName: medicationId
      ? medicationLabel(medication?.name ? { name: medication.name, strength: medication.strength } : null)
      : null,
  };
}

/** The same local write as before sheets had URLs; live queries show it, and PowerSync uploads it. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  // A dose is written through the medications module (its medication is fixed).
  const [row] = await readRows<EntryRow>(db, { sql: entrySql, params: [params.entryId] });
  if (row?.kind === "dose") {
    const result = await updateDose(db, params.entryId, dosePatchFromForm(form));
    return result.ok ? { ok: true } : result;
  }
  // The units the form displayed, so vitals convert back the way they were typed.
  const units = parseUnits(formString(form, "units"));
  return updateEntry(db, params.entryId, entryUpdateFromForm(form, units));
}

export default function EditEntrySheet({ loaderData, params }: Route.ComponentProps) {
  const { entry, medicationName } = loaderData;
  const { units } = useTimelineOutlet();
  const close = useCloseSheet();

  // Deleted on another device (or this one) while open: close, and show the timeline.
  // (`initial` must keep its identity across renders, or the hook resets on each one.)
  const initial = useMemo(() => [{ id: entry.id } as EntryRow], [entry.id]);
  const live = useLiveQuery<EntryRow>(liveEntrySql, [entry.id, params.groupId], initial);
  const gone = live.length === 0;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet
      guardChanges
      isOpen={!gone}
      onOpenChange={(open) => !open && close()}
      title={`Edit ${KIND_META[entry.kind].label.toLowerCase()}`}
    >
      {/* The entry as it was when the sheet opened; a new entry is a new form. */}
      {entry.kind === "dose" ? (
        <DoseForm
          key={entry.id}
          entry={entry}
          medicationName={medicationName ?? ""}
          onDone={close}
          onCancel={close}
        />
      ) : (
        <EntryForm key={entry.id} entry={entry} units={units} onDone={close} onCancel={close} />
      )}
    </Sheet>
  );
}

import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";
import type { EntryRow } from "~/lib/sync/timeline";

import { useEffect, useMemo } from "react";
import { redirect } from "react-router";
import { KIND_META } from "~/lib/entryDisplay";
import { formString } from "~/lib/form";
import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { readRows, toTimelineEntry, updateEntry } from "~/lib/sync/timeline";
import { entryUpdateFromForm, parseUnits } from "../entryFormData";
import { EntryForm } from "../EntryForm";
import { EntrySheet } from "~/components/forms";
import { useCloseSheet, useTimelineOutlet } from "../sheet";
import { editSheetGuard } from "../sheetGuard";

// Shared by web + native. `timeline/:entryId/edit`: a symptom's or vital's
// edit sheet, over the timeline. A note or event goes to its page; a missing,
// deleted or other group's entry, or a viewer, lands on the timeline.

/** The entry as the device has it, in any group and deleted or not: the guard decides. */
const entrySql = "SELECT * FROM timeline_entry WHERE id = ?";
/** The same entry while the sheet is open: gone means deleted (or moved out of reach). */
const liveEntrySql = "SELECT * FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [row] = await readRows<EntryRow>(db, { sql: entrySql, params: [params.entryId] });
  const decision = editSheetGuard({
    groupId: group.id,
    entry: row ? toTimelineEntry(row) : null,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return decision.sheet;
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
  // The units the form displayed, so vitals convert back the way they were typed.
  const units = parseUnits(formString(form, "units"));
  return updateEntry(db, params.entryId, entryUpdateFromForm(form, units));
}

export default function EditEntrySheet({ loaderData, params }: Route.ComponentProps) {
  const { entry } = loaderData;
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
    <EntrySheet
      isOpen={!gone}
      onOpenChange={(open) => !open && close()}
      title={`Edit ${KIND_META[entry.kind].label.toLowerCase()}`}
    >
      {/* The entry as it was when the sheet opened; a new entry is a new form. */}
      <EntryForm key={entry.id} entry={entry} units={units} onDone={close} onCancel={close} />
    </EntrySheet>
  );
}

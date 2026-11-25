import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";

import { useState } from "react";
import { Outlet } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { useMemberNames } from "~/lib/care-groups/memberNames.sync";
import { loadDueDoses } from "~/lib/medications/dueDoses.sync";
import { onlyMedicationSheetChanged } from "~/lib/medications/medicationSheets";
import { createPass, removePass, updatePass } from "~/lib/medications/medicationPasses.sync";
import { passActionFromForm } from "./passActions";
import { PassForm } from "./PassForm";
import { PassList } from "./PassList";
import { loadPasses, usePasses, usePassZoneNote, useTodayPasses } from "./usePasses";

// Shared by web + native. `medications/passes`, the Medications page's
// Passes tab (the header above it is the layout's): the group's medication
// passes (Morning, Evening…) in the day's order, with the medications in
// each and today's state of each, read from the device's local copy (live,
// so it works offline and follows other members' changes). Writers log a
// pass (Given all, as on Schedule), rename, retime and delete them here (local writes; see lib/medications/medicationPasses.sync.ts)
// and add one in the add-pass sheet (`new`, a child route, opened from the
// header's `+`). Viewers read only.

export const meta = () => [{ title: "Med times · Medications · Caretook" }];

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [passes, due] = await Promise.all([loadPasses(db, params.groupId), loadDueDoses(db, params.groupId)]);
  return { ...passes, due };
}

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const action = passActionFromForm(await request.formData());
  if (!action) return { ok: false, error: "Nothing to do", issues: [] };
  switch (action.intent) {
    case "create":
      return createPass(db, group.id, { name: action.name, time: action.time });
    case "update":
      return updatePass(db, action.passId, { name: action.name, time: action.time });
    case "remove":
      return removePass(db, action.passId);
  }
}

/** Live queries keep the screen current, the add-pass sheet's opening and closing too: only another group reruns the loader. */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  if (nextParams.groupId && onlyMedicationSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function MedicationPasses({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const passes = usePasses(params.groupId, loaderData);
  const { today, timeZone } = useTodayPasses(params.groupId, loaderData.due);
  const nameOf = useMemberNames(params.groupId, group.userId);
  // The edit sheet's pass (adding is the `new` route's sheet).
  const [editing, setEditing] = useState<LocalPass | null>(null);
  const zoneNote = usePassZoneNote();
  const close = () => setEditing(null);

  return (
    <div className="space-y-4" data-passes-page>
      <p className="text-muted text-sm" data-passes-description>
        The times medications are given, each day.
        {zoneNote && ` ${zoneNote}.`}
        {!group.canWrite && " You can view the med times."}
      </p>

      <PassList
        groupId={params.groupId}
        passes={passes}
        today={today}
        timeZone={timeZone}
        canWrite={group.canWrite}
        nameOf={nameOf}
        onEdit={setEditing}
      />

      {editing && (
        <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title={`Edit ${editing.name}`}>
          <PassForm pass={editing} zoneNote={zoneNote} onDone={close} onCancel={close} />
        </Sheet>
      )}

      {/* The add-pass sheet. */}
      <Outlet />
    </div>
  );
}

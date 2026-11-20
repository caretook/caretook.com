import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { LocalPass } from "~/lib/sync/medicationPasses";

import { canAddPass } from "@caretook/data/schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { BackLink, Sheet } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { scheduleZoneNote } from "~/lib/medicationDisplay";
import { sessionContext } from "~/lib/session";
import { createPass, movePass, removePass, updatePass } from "~/lib/sync/medicationPasses";
import { passActionFromForm } from "./passActions";
import { PassForm } from "./PassForm";
import { PassList } from "./PassList";
import { loadPasses, usePasses } from "./usePasses";

// Shared by web + native. `medications/passes`: the group's medication passes
// (Morning, Evening…) in the day's order, with the medications in each, read
// from the device's local copy (live, so it works offline and follows other
// members' changes). Writers add, rename, retime, reorder and delete them
// (local writes; see lib/sync/medicationPasses.ts). Viewers read only.

export const meta = () => [{ title: "Passes · Medications · Caretook" }];

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadPasses(db, params.groupId);
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
    case "move":
      return movePass(db, action.passId, action.direction);
    case "remove":
      return removePass(db, action.passId);
  }
}

/** Live queries keep the screen current: only another group reruns the loader. */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function MedicationPasses({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const passes = usePasses(params.groupId, loaderData);
  // The sheet: adding (`"new"`) or editing a pass.
  const [editing, setEditing] = useState<LocalPass | "new" | null>(null);
  const zoneNote = scheduleZoneNote(
    group.recipient?.timeZone ?? null,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const close = () => setEditing(null);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-passes-page>
      <BackLink to={appUrls.medications(params.groupId)} label="Medications" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Passes</h1>
          <p className="text-base-content/70 text-sm">
            The rounds medications are given in, each day.
            {zoneNote && ` ${zoneNote}.`}
            {!group.canWrite && " You can view the passes."}
          </p>
        </div>
        {group.canWrite && canAddPass(passes.map((p) => p.pass)) && (
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            onClick={() => setEditing("new")}
            data-add-pass
          >
            <Plus className="size-4" aria-hidden="true" />
            Add pass
          </button>
        )}
      </header>

      <PassList groupId={params.groupId} passes={passes} canWrite={group.canWrite} onEdit={setEditing} />

      {editing && (
        <Sheet
          isOpen
          onOpenChange={(open) => !open && close()}
          title={editing === "new" ? "Add a pass" : `Edit ${editing.name}`}
        >
          <PassForm
            pass={editing === "new" ? undefined : editing}
            zoneNote={zoneNote}
            onDone={close}
            onCancel={close}
          />
        </Sheet>
      )}
    </main>
  );
}

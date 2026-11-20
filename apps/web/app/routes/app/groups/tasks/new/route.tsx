import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";

import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { TASK_PREFILL_PARAMS } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { scheduleZoneNote } from "~/lib/medicationDisplay";
import { sessionContext } from "~/lib/session";
import { createTask } from "~/lib/sync/tasks";
import { TaskForm } from "../TaskForm";
import { taskFromForm } from "../taskFormData";
import { loadMembers, useAssigneeMembers, useCloseTaskSheet } from "../taskSheet";
import { newTaskGuard } from "~/lib/taskSheets";

// Shared by web + native. `tasks/new`: the add sheet, over the list. It can
// start with a due day (`?dueOn=`). A viewer lands on the list.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newTaskGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  return { memberRows: await loadMembers(db, group.id) };
}

/** A local write; the list's live query shows it, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await createTask(db, group.id, taskFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewTaskSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseTaskSheet();
  const group = useGroup();
  const { search } = useLocation();
  const members = useAssigneeMembers(params.groupId, loaderData.memberRows);
  const dueOn = new URLSearchParams(search).get(TASK_PREFILL_PARAMS.dueOn);
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Add a task">
      <TaskForm
        // A new URL is a new form.
        key={search}
        members={members}
        meId={group.userId}
        dueOn={dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null}
        zoneNote={scheduleZoneNote(
          group.recipient?.timeZone ?? null,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )}
        onDone={close}
        onCancel={close}
      />
    </Sheet>
  );
}

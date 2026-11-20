import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { TaskRow } from "~/lib/tasks/tasks.sync";

import { useEffect } from "react";
import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { taskQuery, toTask, updateTask } from "~/lib/tasks/tasks.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { TaskForm } from "../TaskForm";
import { taskFromForm } from "../taskFormData";
import {
  loadLinkChoices,
  loadMembers,
  useAssigneeMembers,
  useCloseTaskSheet,
  useLinkChoices,
} from "../taskSheet";
import { editTaskGuard } from "~/lib/tasks/taskSheets";

const NO_ROWS: TaskRow[] = [];

// Shared by web + native. `tasks/:taskId/edit`: the edit sheet, over the
// list. A viewer, and a task that's missing, deleted or in another group,
// land on the list.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [row] = await readRows<TaskRow>(db, taskQuery(params.taskId));
  const decision = editTaskGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    task: row ? toTask(row) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const [memberRows, linkRows] = await Promise.all([
    loadMembers(db, group.id),
    loadLinkChoices(db, group.id, decision.sheet.eventId),
  ]);
  return { task: decision.sheet, memberRows, linkRows };
}

/** A local write; the list's live query shows it, and PowerSync uploads it. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await updateTask(db, params.taskId, taskFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its loader doesn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditTaskSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseTaskSheet();
  const group = useGroup();
  const members = useAssigneeMembers(params.groupId, loaderData.memberRows);
  const links = useLinkChoices(params.groupId, loaderData.linkRows);

  // Deleted elsewhere: nothing left to edit.
  const query = taskQuery(params.taskId);
  const rows = useLiveQuery<TaskRow>(query.sql, query.params, NO_ROWS);
  const live = rows[0] ? toTask(rows[0]) : undefined;
  const gone = !!live?.deletedAt;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Edit task">
      <TaskForm
        key={loaderData.task.id}
        task={loaderData.task}
        members={members}
        meId={group.userId}
        links={links}
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

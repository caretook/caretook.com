import type { SyncDb } from "~/lib/sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { TaskRow } from "~/lib/tasks/tasks.sync";
import type { EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";

import { data } from "react-router";
import { medicationQuery } from "~/lib/medications/medications.sync";
import { providerQuery } from "~/lib/providers/providers.sync";
import { linkedEventQuery, taskQuery, toTask } from "~/lib/tasks/tasks.sync";
import { membersQuery, readRows } from "~/lib/timeline/timeline.sync";

/**
 * The task, the group's members (for the assignee and who finished it), its
 * links' rows, and its notes document with pending updates. A task that isn't on the device,
 * is deleted, or is in another group is a 404 with no names. (The group
 * route has already turned away a non-member.)
 */
export async function loadTask(db: SyncDb, groupId: string, taskId: string) {
  const taskRows = await readRows<TaskRow>(db, taskQuery(taskId));
  const task = taskRows[0] ? toTask(taskRows[0]) : null;
  if (!task || task.groupId !== groupId || task.deletedAt) throw data("Not found", { status: 404 });
  const none = Promise.resolve([]);
  const [memberRows, [doc], provider, medication, event] = await Promise.all([
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<{ id: string; snapshot: string | null }>(db, {
      sql: "SELECT id, snapshot FROM note_document WHERE id = ? AND group_id = ?",
      params: [taskId, groupId],
    }),
    task.providerId ? readRows<ProviderRow>(db, providerQuery(task.providerId)) : none,
    task.medicationId ? readRows<MedicationRow>(db, medicationQuery(task.medicationId)) : none,
    task.eventId ? readRows<EntryRow>(db, linkedEventQuery(task.eventId)) : none,
  ]);
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [taskId],
      })
    : [];
  return {
    task,
    // Starting rows for the live queries (stable, so they don't reset each render).
    taskRows,
    memberRows,
    linkRows: { provider, medication, event },
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
  };
}

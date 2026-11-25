import type { SyncDb } from "~/lib/sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { TodoRow } from "~/lib/todos/todos.sync";
import type { EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";

import { data } from "react-router";
import { medicationQuery } from "~/lib/medications/medications.sync";
import { providerQuery } from "~/lib/providers/providers.sync";
import { linkedEventsQuery, todoQuery, toTodo } from "~/lib/todos/todos.sync";
import { membersQuery, readRows } from "~/lib/timeline/timeline.sync";

/**
 * The todo, the group's members (for the assignee and who finished it), its
 * links' rows, and its notes document with pending updates. A todo that isn't on the device,
 * is deleted, or is in another group is a 404 with no names. (The group
 * route has already turned away a non-member.)
 */
export async function loadTodo(db: SyncDb, groupId: string, todoId: string) {
  const todoRows = await readRows<TodoRow>(db, todoQuery(todoId));
  const todo = todoRows[0] ? toTodo(todoRows[0]) : null;
  if (!todo || todo.groupId !== groupId || todo.deletedAt) throw data("Not found", { status: 404 });
  const none = Promise.resolve([]);
  const [memberRows, [doc], provider, medication, event] = await Promise.all([
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<{ id: string; snapshot: string | null }>(db, {
      sql: "SELECT id, snapshot FROM note_document WHERE id = ? AND group_id = ?",
      params: [todoId, groupId],
    }),
    todo.providerId ? readRows<ProviderRow>(db, providerQuery(todo.providerId)) : none,
    todo.medicationId ? readRows<MedicationRow>(db, medicationQuery(todo.medicationId)) : none,
    readRows<EntryRow>(db, linkedEventsQuery(todoId)),
  ]);
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [todoId],
      })
    : [];
  return {
    todo,
    // Starting rows for the live queries (stable, so they don't reset each render).
    todoRows,
    memberRows,
    linkRows: { provider, medication, event },
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
  };
}

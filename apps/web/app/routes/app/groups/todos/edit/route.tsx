import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { TodoRow } from "~/lib/todos/todos.sync";

import { useEffect } from "react";
import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { todoQuery, toTodo, updateTodo } from "~/lib/todos/todos.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { TodoForm } from "../TodoForm";
import { todoFromForm } from "../todoFormData";
import {
  loadLinkChoices,
  loadMembers,
  useAssigneeMembers,
  useCloseTodoSheet,
  useLinkChoices,
} from "../todoSheet";
import { editTodoGuard } from "~/lib/todos/todoSheets";

const NO_ROWS: TodoRow[] = [];

// Shared by web + native. `todos/:todoId/edit`: the edit sheet, over the
// list. A viewer, and a todo that's missing, deleted or in another group,
// land on the list.

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [row] = await readRows<TodoRow>(db, todoQuery(params.todoId));
  const decision = editTodoGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
    todo: row ? toTodo(row) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const [memberRows, linkRows] = await Promise.all([
    loadMembers(db, group.id),
    loadLinkChoices(db, group.id, decision.sheet.eventId),
  ]);
  return { todo: decision.sheet, memberRows, linkRows };
}

/** A local write; the list's live query shows it, and PowerSync uploads it. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await updateTodo(db, params.todoId, todoFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its loader doesn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditTodoSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseTodoSheet();
  const group = useGroup();
  const members = useAssigneeMembers(params.groupId, loaderData.memberRows);
  const links = useLinkChoices(params.groupId, loaderData.linkRows);

  // Deleted elsewhere: nothing left to edit.
  const query = todoQuery(params.todoId);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, NO_ROWS);
  const live = rows[0] ? toTodo(rows[0]) : undefined;
  const gone = !!live?.deletedAt;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Edit todo">
      <TodoForm
        key={loaderData.todo.id}
        todo={loaderData.todo}
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

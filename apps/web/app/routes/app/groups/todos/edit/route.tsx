import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { TodoRow } from "~/lib/todos/todos.sync";

import { useEffect } from "react";
import { redirect } from "react-router";
import { QuickTags } from "~/components/tags";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { subtasksQuery, todoQuery, toTodo, updateTodo } from "~/lib/todos/todos.sync";
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
// land on the list. Its tags (`QuickTags`, tags-2) sit under the form: each
// tap is its own local write, never part of Save.

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
  const [memberRows, linkRows, subtaskRows] = await Promise.all([
    loadMembers(db, group.id),
    // No appointment picker on edit: a todo's events are link rows, which the form leaves alone.
    loadLinkChoices(db, group.id, null),
    readRows<TodoRow>(db, subtasksQuery(params.todoId)),
  ]);
  return { todo: decision.sheet, memberRows, linkRows, subtaskRows };
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
  // A subtask, or a todo with subtasks, doesn't repeat (todo-subtasks): no Repeat.
  const subQuery = subtasksQuery(params.todoId);
  const subtaskRows = useLiveQuery<TodoRow>(subQuery.sql, subQuery.params, loaderData.subtaskRows);
  const repeatable = !loaderData.todo.parentId && subtaskRows.length === 0;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return (
    <Sheet guardChanges={!gone} isOpen onOpenChange={(open) => !open && close()} title="Edit todo">
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
        repeatable={repeatable}
        onDone={close}
        onCancel={close}
      />
      {!gone && (
        <div className="border-base-300 mt-4 border-t pt-4" data-todo-edit-tags="">
          <QuickTags
            target="todo"
            recordId={params.todoId}
            label={live?.title ?? loaderData.todo.title}
            createdBy={loaderData.todo.createdBy}
            max={null}
          />
        </div>
      )}
    </Sheet>
  );
}

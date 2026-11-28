import { Message, Page } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LocalTodo, SubtaskProgressRow, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { TodoUndoStatus, useTodoTick } from "~/components/todos";
import { sessionContext } from "~/lib/auth/session";
import { subtaskProgressQuery, todosQuery, todoTreesQuery } from "~/lib/todos/todos.sync";
import { membersQuery, readRows } from "~/lib/timeline/timeline.sync";
import { emptyTodosText, todoQueryOf } from "~/lib/todos/todoList";
import { todoViewOf } from "~/lib/todos/todoView";
import { PlannerHeader } from "../planner/PlannerHeader";
import { DoneTodos } from "./DoneTodos";
import { todoFilterBar } from "./TodoFilters";
import { TodoSections } from "./TodoSections";
import { onlyTodoSheetChanged } from "~/lib/todos/todoSheets";
import { useTodoList } from "./useTodoList";

// Shared by web + native. The Planner section's Todos tab: the group's
// todos, read from the device's local copy (live, so it works offline and
// follows other members' changes): the open ones the Filter menu's Assigned
// to shows (Everyone, or `?who=` Mine / Unassigned) and the search box's text
// (`?q=`) keeps, as trees (todo-subtasks-3: a subtask shows only in its tree,
// with a quick add on each row for writers; or, with `?subtasks=own`, each on
// its own row with "Part of": todo-links-2) in sections by due, then Done (trees too). A tick
// completes a todo on the device, with Undo. The add and edit sheets render
// over it (the header's Add menu opens the add sheet).

export const meta = () => [{ title: "Todos · Caretook" }];

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { db } = context.get(sessionContext);
  const [openRows, memberRows, progressRows] = await Promise.all([
    readRows<TodoRow>(db, todoTreesQuery(params.groupId)),
    readRows<MemberRow>(db, membersQuery(params.groupId)),
    readRows<SubtaskProgressRow>(db, subtaskProgressQuery(params.groupId)),
  ]);
  const search = new URL(request.url).search;
  const doneRows = await readRows<TodoRow>(
    db,
    todosQuery(params.groupId, { done: true, doneListed: todoViewOf(search) === "tree" }),
  );
  return { openRows, doneRows, memberRows, progressRows };
}

/**
 * The live queries follow every change and the filter is applied on the
 * device, so a filter change (same path) or a sheet opening and closing over
 * the list doesn't rerun the loader. Anything else (another group) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  if (nextParams.groupId && onlyTodoSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function Todos({ loaderData, params }: Route.ComponentProps) {
  // The box filters as you type; the URL follows (see `SearchFilterBar`).
  const urlQuery = todoQueryOf(useLocation().search);
  const [text, setText] = useState(urlQuery);
  const list = useTodoList(params.groupId, loaderData, text);
  const { complete, reopen, busy, error } = useTodoTick(params.groupId);
  const onTick = useCallback(
    (todo: LocalTodo, done: boolean) => void (done ? complete(todo) : reopen(todo)),
    [complete, reopen],
  );
  const tagsOf = useCallback((todoId: string) => list.tagsOf.get(todoId), [list.tagsOf]);
  const row = {
    nameOf: list.nameOf,
    now: list.now,
    timeZone: list.timeZone,
    onTick,
    busy,
    tagsOf,
    progressOf: list.progressOf,
    parentOf: list.parentOf,
  };

  return (
    <Page>
      <PlannerHeader
        bar={todoFilterBar({
          who: list.who,
          view: list.view,
          tags: list.tags,
          value: text,
          urlQuery,
          onChange: setText,
        })}
      />

      <TodoUndoStatus groupId={params.groupId} />
      {error && <Message tone="error">{error}</Message>}

      <TodoSections
        sections={list.sections}
        empty={emptyTodosText(list.who, text, list.tag?.name)}
        {...row}
      />
      <DoneTodos trees={list.done} more={list.moreDone} onMore={list.showMoreDone} {...row} />

      {/* The add and edit sheets render here, over the list. */}
      <Outlet />
    </Page>
  );
}

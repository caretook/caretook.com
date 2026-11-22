import { Page } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback } from "react";
import { Outlet } from "react-router";
import { TodoUndoStatus, useTodoTick } from "~/components/todos";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { todosQuery } from "~/lib/todos/todos.sync";
import { membersQuery, readRows } from "~/lib/timeline/timeline.sync";
import { whoOf } from "~/lib/todos/todoList";
import { PlannerHeader } from "../planner/PlannerHeader";
import { DoneTodos } from "./DoneTodos";
import { TodoFilterRow } from "./TodoFilters";
import { TodoSections } from "./TodoSections";
import { onlyTodoSheetChanged } from "~/lib/todos/todoSheets";
import { DONE_PAGE, useTodoList } from "./useTodoList";

// Shared by web + native. The Planner section's Todos tab: the group's
// todos, read from the device's local copy (live, so it works offline and
// follows other members' changes): the open ones the Filter menu's Assigned
// to shows (Everyone, or `?who=` Mine / Unassigned), in sections by due, then Done. A tick
// completes a todo on the device, with Undo. The add and edit sheets render
// over it (the header's Add menu opens the add sheet).

export const meta = () => [{ title: "Todos · Caretook" }];

const EMPTY: Record<string, string> = {
  mine: "Nothing assigned to you.",
  unassigned: "No unassigned todos.",
  everyone: "No open todos.",
};

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [openRows, memberRows] = await Promise.all([
    readRows<TodoRow>(db, todosQuery(params.groupId)),
    readRows<MemberRow>(db, membersQuery(params.groupId)),
  ]);
  const who = whoOf(new URL(request.url).search);
  const doneRows = await readRows<TodoRow>(
    db,
    todosQuery(params.groupId, { done: true, who, userId: group.userId, limit: DONE_PAGE }),
  );
  return { openRows, doneRows, memberRows };
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
  const list = useTodoList(params.groupId, loaderData);
  const { complete, reopen, busy, error } = useTodoTick(params.groupId);
  const onTick = useCallback(
    (todo: LocalTodo, done: boolean) => void (done ? complete(todo) : reopen(todo)),
    [complete, reopen],
  );
  const row = { nameOf: list.nameOf, now: list.now, timeZone: list.timeZone, onTick, busy };

  return (
    <Page>
      <PlannerHeader />

      <TodoFilterRow who={list.who} />
      <TodoUndoStatus groupId={params.groupId} />
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      <TodoSections sections={list.sections} empty={EMPTY[list.who] ?? EMPTY.everyone!} {...row} />
      <DoneTodos todos={list.done} more={list.moreDone} onMore={list.showMoreDone} {...row} />

      {/* The add and edit sheets render here, over the list. */}
      <Outlet />
    </Page>
  );
}

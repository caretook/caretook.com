import type { LocalTodo, TodoLink } from "~/lib/todos/todos.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { Plus, UserRound } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { linkOf } from "~/lib/todos/todos.sync";
import { assigneeLabel, dueText } from "~/lib/todos/todoDisplay";
import { TODO_SHEET_STATE } from "~/lib/todos/todoSheetLink";
import { TodoTick } from "./TodoTick";
import { TodoUndoStatus } from "./TodoUndoStatus";
import { useLinkedTodos } from "./useLinkedTodos";
import { useTodoTick } from "./useTodoTick";

/**
 * The open todos linked to this provider, medication or appointment (todos
 * PRD): each with its tick (for whoever may complete it; Undo for about
 * 10 s), its title opening the todo, its due line and assignee. Hidden when
 * there are none, apart from writers' "Add todo", which opens the add
 * sheet with the link filled in (and comes back here when it closes).
 */
export function LinkedTodos({ link, className = "" }: { link: TodoLink; className?: string }) {
  const group = useGroup();
  const { todos, nameOf, now, timeZone, ticked, shown } = useLinkedTodos(link);
  const { complete, reopen, busy, error } = useTodoTick(group.id);
  const { field, id } = linkOf(link);
  if (!shown && !group.canWrite) return null;

  const add = group.canWrite && (
    <Link
      to={appUrls.newTodo(group.id, { [field]: id })}
      // Closing the sheet comes back here.
      state={TODO_SHEET_STATE}
      prefetch="render"
      className="btn btn-ghost btn-sm gap-1"
      data-linked-todos-add
    >
      <Plus className="size-4" aria-hidden="true" />
      Add todo
    </Link>
  );
  if (!shown) return <div className={className}>{add}</div>;

  const tick = (todo: LocalTodo, done: boolean) => {
    if (done) ticked(todo.id);
    void (done ? complete(todo) : reopen(todo));
  };
  return (
    <section aria-labelledby={`linked-todos-${id}`} className={`space-y-2 ${className}`} data-linked-todos="">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`linked-todos-${id}`} className="font-semibold">
          Todos
        </h2>
        {add}
      </div>
      {todos.length > 0 && (
        <ul
          className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border px-3"
          aria-label="Open todos"
        >
          {todos.map((todo) => {
            const state = todoState(todo, now, timeZone);
            const assignee = assigneeLabel(todo, nameOf);
            return (
              <li
                key={todo.id}
                className="flex items-start gap-3 py-2.5"
                data-todo={todo.id}
                data-todo-state={state}
              >
                {canCompleteTodo({ role: group.role, userId: group.userId, todo: todo }) ? (
                  <TodoTick
                    title={todo.title}
                    done={!!todo.doneAt}
                    disabled={busy}
                    onChange={(done) => tick(todo, done)}
                  />
                ) : (
                  <span className="w-6 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    to={appUrls.todo(group.id, todo.id)}
                    className="link-hover block font-medium break-words"
                    data-todo-title
                  >
                    {todo.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span
                      className={state === "overdue" ? "text-error" : "text-base-content/70"}
                      data-todo-due
                    >
                      {dueText(todo, now, timeZone)}
                    </span>
                    <span
                      className="badge badge-ghost badge-sm gap-1 whitespace-nowrap"
                      data-todo-assignee={assignee.type}
                    >
                      {assignee.type === "name" && <UserRound className="size-3" aria-hidden="true" />}
                      {assignee.label}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TodoUndoStatus groupId={group.id} />
      {error && <p className="text-error text-sm">{error}</p>}
    </section>
  );
}

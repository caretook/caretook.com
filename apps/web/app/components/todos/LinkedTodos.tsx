import type { LocalTodo, TodoLink } from "~/lib/todos/todos.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { UserRound } from "lucide-react";
import { Link } from "react-router";
import { Badge, Message, Section, TITLE_SECTION } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { linkOf } from "~/lib/todos/todos.sync";
import { assigneeLabel, dueText } from "~/lib/todos/todoDisplay";
import { mayAddTodo, TodoQuickAdd } from "./TodoQuickAdd";
import { TodoTick } from "./TodoTick";
import { TodoUndoStatus } from "./TodoUndoStatus";
import { useLinkedTodos } from "./useLinkedTodos";
import { useQuickAddChains } from "./useQuickAddChains";
import { useTodoTick } from "./useTodoTick";

/**
 * The open todos linked to this provider, medication or appointment (todos
 * PRD): each with its tick (for whoever may complete it; Undo for about
 * 10 s), its title opening the todo, its due line and assignee. Writers
 * get the full quick add (a todo linked here) under the list, even while
 * it's empty (one steady section, so the field keeps focus as the first
 * one lists), and each open row's compact one (a subtask, linked here too,
 * so it lists here); readers see nothing while there are none.
 *
 * `band`: on a banded page (a provider's, a medication's) it is a `Section`
 * of its own; without it, a plain section. An entry's page has its own
 * Todos (`EntryTodos`, planner-3).
 */
export function LinkedTodos({
  link,
  band = false,
  className = "",
}: {
  link: TodoLink;
  band?: boolean;
  className?: string;
}) {
  const group = useGroup();
  const { todos, nameOf, now, timeZone, ticked, shown } = useLinkedTodos(link);
  const { complete, reopen, busy, error } = useTodoTick(group.id);
  const chainOf = useQuickAddChains(todos);
  const { id } = linkOf(link);
  const writer = mayAddTodo(group.role);
  if (!shown && !writer) return null;

  const tick = (todo: LocalTodo, done: boolean) => {
    if (done) ticked(todo.id);
    void (done ? complete(todo) : reopen(todo));
  };
  const list = (
    <>
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
                    <span className={state === "overdue" ? "text-error-ink" : "text-muted"} data-todo-due>
                      {dueText(todo, now, timeZone)}
                    </span>
                    <Badge
                      icon={assignee.type === "name" ? UserRound : undefined}
                      className="whitespace-nowrap"
                      data-todo-assignee={assignee.type}
                    >
                      {assignee.label}
                    </Badge>
                  </p>
                  <TodoQuickAdd
                    parent={todo}
                    ancestors={chainOf(todo)}
                    link={link}
                    form="compact"
                    className="mt-1"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TodoQuickAdd link={link} form="full" />
      <TodoUndoStatus groupId={group.id} />
      {error && <Message tone="error">{error}</Message>}
    </>
  );
  if (band) {
    return (
      <Section title="Todos" className={className} data-linked-todos="">
        {list}
      </Section>
    );
  }
  return (
    <section aria-labelledby={`linked-todos-${id}`} className={`space-y-2 ${className}`} data-linked-todos="">
      <h2 id={`linked-todos-${id}`} className={TITLE_SECTION}>
        Todos
      </h2>
      {list}
    </section>
  );
}

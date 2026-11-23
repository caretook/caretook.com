import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { ListChecks } from "lucide-react";
import { Link } from "react-router";
import { TodoRepeatMark, TodoTick, TodoUndoStatus, useTodoTick } from "~/components/todos";
import { ICON_LG, LINK, Message, Skeleton } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { dueText } from "~/lib/todos/todoDisplay";
import { EASY_BLOCK, EASY_HEADING, STALE } from "./layout";
import { useEasyTodos } from "./useEasyTodos";

/**
 * Easy mode's "My todos" card (todos PRD): my open todos, overdue and
 * today first, at most five, each with a big tick (Undo for about 10 s) and
 * its title opening its page, and "See all" to the Todos list on Mine. The
 * easy roles, who have no Todos list, get every one of theirs and no "See all". Viewers get it too (they may
 * complete what they were given). Nothing when I have none. Not a tile:
 * the tiles open entry forms.
 *
 * It never pops in (the tile cache): todos remembered from earlier this
 * session paint at once, dimmed (`data-stale`, ticks off) until the device
 * confirms them; on a first visit a skeleton holds its place.
 */
export function EasyTodos({ className = "" }: { className?: string }) {
  const group = useGroup();
  const { todos, total, shown, ready, fresh, now, timeZone } = useEasyTodos(group.id);
  const { complete, reopen, busy, error } = useTodoTick(group.id);
  if (!ready)
    return (
      <div className={`h-32 ${className}`} aria-hidden="true" data-easy-skeleton="todos">
        <Skeleton lines={5} />
      </div>
    );
  if (!shown) return null;

  const tick = (todo: LocalTodo, done: boolean) => void (done ? complete(todo) : reopen(todo));
  return (
    <section
      aria-label="My todos"
      className={`space-y-3 ${EASY_BLOCK} ${fresh ? "" : STALE} ${className}`}
      data-easy-todos=""
      data-stale={fresh ? undefined : ""}
    >
      <h2 className={EASY_HEADING}>
        <ListChecks aria-hidden="true" className={`text-primary ${ICON_LG}`} />
        My todos
      </h2>
      {todos.length > 0 && (
        <ul className="space-y-1" aria-label="My open todos">
          {todos.map((todo) => {
            const state = todoState(todo, now, timeZone);
            return (
              <li
                key={todo.id}
                className="flex items-center gap-4 py-2"
                data-easy-todo={todo.id}
                data-todo-state={state}
              >
                {canCompleteTodo({ role: group.role, userId: group.userId, todo: todo }) ? (
                  <TodoTick
                    title={todo.title}
                    done={!!todo.doneAt}
                    disabled={busy || !fresh}
                    large
                    onChange={(done) => tick(todo, done)}
                  />
                ) : (
                  <span className="size-8 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-medium break-words" data-todo-title>
                    <Link to={appUrls.todo(group.id, todo.id)} className="link link-hover">
                      {todo.title}
                    </Link>
                  </p>
                  <p
                    className={`text-base ${state === "overdue" ? "text-error-ink" : "text-muted"}`}
                    data-todo-due
                  >
                    {dueText(todo, now, timeZone)}
                    <TodoRepeatMark todo={todo} className="ms-1.5" />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TodoUndoStatus groupId={group.id} className="text-base" />
      <Message tone="error" className="text-base!">
        {error}
      </Message>
      {!group.easyRole && (
        <p className="text-xl">
          <Link to={appUrls.todos(group.id, "?who=mine")} className={LINK} data-easy-todos-all="">
            {total > todos.length ? `See all ${total} todos` : "See all"}
          </Link>
        </p>
      )}
    </section>
  );
}

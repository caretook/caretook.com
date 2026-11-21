import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { TodoRepeatMark, TodoTick } from "~/components/todos";
import { ViaTag } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { assigneeLabel, doneText, dueText } from "~/lib/todos/todoDisplay";
import { todoPageState } from "~/lib/todos/todoSheets";

const ASSIGNEE_CHIP = "badge badge-ghost badge-sm gap-1 whitespace-nowrap";

/**
 * One todo: its tick (for whoever may complete it), the title (opening the
 * todo's page, for everyone), the due line (red when overdue) or the done
 * line, the repeat mark when it repeats, and the assignee chip.
 */
export function TodoRow({
  todo,
  nameOf,
  now,
  timeZone,
  onTick,
  busy,
}: {
  todo: LocalTodo;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  onTick: (todo: LocalTodo, done: boolean) => void;
  busy: boolean;
}) {
  const group = useGroup();
  const { search } = useLocation();
  const mayTick = canCompleteTodo({ role: group.role, userId: group.userId, todo: todo });
  const state = todoState(todo, now, timeZone);
  const assignee = assigneeLabel(todo, nameOf);
  const line = todo.doneAt ? doneText(todo, nameOf, now, timeZone) : dueText(todo, now, timeZone);

  return (
    <li className="flex items-start gap-3 py-2.5" data-todo={todo.id} data-todo-state={state}>
      {mayTick ? (
        <TodoTick
          title={todo.title}
          done={!!todo.doneAt}
          disabled={busy}
          onChange={(done) => onTick(todo, done)}
        />
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          to={appUrls.todo(group.id, todo.id)}
          // The page's way back keeps the list's chip.
          state={todoPageState(search)}
          className={`link-hover block font-medium break-words ${todo.doneAt ? "text-base-content/60 line-through" : ""}`}
          data-todo-title
        >
          {todo.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {line && (
            <span className={state === "overdue" ? "text-error" : "text-base-content/70"} data-todo-due>
              {line}
            </span>
          )}
          <TodoRepeatMark todo={todo} className="text-base-content/70" />
          <span className={ASSIGNEE_CHIP} data-todo-assignee={assignee.type}>
            {assignee.type === "name" && <UserRound className="size-3" aria-hidden="true" />}
            {assignee.label}
          </span>
          <ViaTag via={todo.via} />
        </p>
      </div>
    </li>
  );
}

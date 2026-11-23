import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { PlannerTodo } from "~/lib/todos/plannerTodos";

import { canCompleteTodo } from "@caretook/data/schema";
import { ListTodo, UserRound } from "lucide-react";
import { Link } from "react-router";
import { TodoRepeatMark, TodoTick, useTodoTick } from "~/components/todos";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { assigneeLabel, dueText } from "~/lib/todos/todoDisplay";

/**
 * One open dated todo on the Planner tab: its tick (for whoever may complete it:
 * writers, or the viewer it's assigned to; a todo icon otherwise), its time
 * (the due time, wall-clock in the recipient's zone, "All day", or
 * "Overdue") with the assignee under it, the title, and the due line when
 * it's overdue. The row opens the todo's page. Ticking completes it (Undo in the list's
 * `TodoUndoStatus`), and it drops out. It's never an entry.
 */
export function PlannerTodoRow({
  item,
  nameOf,
  timeZone,
  now,
}: {
  item: PlannerTodo<LocalTodo>;
  /** A member's name ("you" for me). */
  nameOf: (userId: string) => string;
  /** The recipient's zone. */
  timeZone: string;
  now: Date;
}) {
  const group = useGroup();
  const { todo, state } = item;
  const { title } = todo;
  const tick = useTodoTick(group.id);
  const mayTick = canCompleteTodo({ role: group.role, userId: group.userId, todo: todo });
  const overdue = state === "overdue";
  const when = overdue ? "Overdue" : (todo.dueTime ?? "All day");
  const due = dueText(todo, now, timeZone);
  const assignee = assigneeLabel(todo, nameOf);

  return (
    <li
      className="relative isolate flex items-start gap-2.5 px-3 py-2"
      data-planner-todo={todo.id}
      data-todo-state={state}
    >
      <Link
        to={appUrls.todo(group.id, todo.id)}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open todo ${title}, ${due}`}
        data-planner-todo-open
      />
      {mayTick ? (
        <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
          <TodoTick
            title={title}
            done={false}
            disabled={tick.busy}
            onChange={(done) => void (done ? tick.complete({ id: todo.id, title }) : tick.reopen(todo))}
          />
        </span>
      ) : (
        <ListTodo className="text-base-content/70 mt-0.5 size-5 shrink-0" aria-hidden="true" />
      )}
      <div className="flex w-[5.5rem] shrink-0 flex-col items-start gap-1" data-when-column>
        <span
          className={`pt-0.5 text-sm tabular-nums ${overdue ? "text-error font-semibold" : "text-base-content/70"}`}
          data-when
        >
          {when}
        </span>
        {/* A long name wraps inside the narrow column rather than running into the title. */}
        <span
          className="badge badge-ghost badge-sm h-auto max-w-full gap-1 py-0.5"
          data-todo-assignee={assignee.type}
        >
          {assignee.type === "name" && <UserRound className="size-3 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 break-words">{assignee.label}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-medium break-words" data-todo-title>
          {title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm empty:hidden">
          {overdue && due && (
            <span className="text-error" data-todo-due>
              {due}
            </span>
          )}
          <TodoRepeatMark todo={todo} className="text-base-content/70" />
        </p>
        {tick.error && (
          <p className="text-error relative z-10 text-sm" role="alert">
            {tick.error}
          </p>
        )}
      </div>
    </li>
  );
}

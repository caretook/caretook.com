import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { UpcomingTodo } from "~/lib/todos/plannerTodos";

import { canCompleteTodo } from "@caretook/data/schema";
import { ListTodo, UserRound } from "lucide-react";
import { Link } from "react-router";
import { TodoTick, useTodoTick } from "~/components/todos";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { assigneeLabel, dueText } from "~/lib/todos/todoDisplay";

/**
 * One open dated todo in Upcoming: its tick (for whoever may complete it:
 * writers, or the viewer it's assigned to; a todo icon otherwise), its time
 * (the due time, wall-clock in the recipient's zone, "All day", or
 * "Overdue"), the title, the due line when it's overdue, and the assignee.
 * The row opens the todo's page. Ticking completes it (Undo in the list's
 * `TodoUndoStatus`), and it drops out. It's never an entry.
 */
export function UpcomingTodoRow({
  item,
  nameOf,
  timeZone,
  now,
}: {
  item: UpcomingTodo<LocalTodo>;
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
      data-upcoming-todo={todo.id}
      data-todo-state={state}
    >
      <Link
        to={appUrls.todo(group.id, todo.id)}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open todo ${title}, ${due}`}
        data-upcoming-todo-open
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
      <span
        className={`w-[5.5rem] shrink-0 pt-0.5 text-sm tabular-nums ${overdue ? "text-error font-semibold" : "text-base-content/70"}`}
        data-when
      >
        {when}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-medium break-words" data-todo-title>
          {title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {overdue && due && (
            <span className="text-error" data-todo-due>
              {due}
            </span>
          )}
          <span
            className="badge badge-ghost badge-sm gap-1 whitespace-nowrap"
            data-todo-assignee={assignee.type}
          >
            {assignee.type === "name" && <UserRound className="size-3" aria-hidden="true" />}
            {assignee.label}
          </span>
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

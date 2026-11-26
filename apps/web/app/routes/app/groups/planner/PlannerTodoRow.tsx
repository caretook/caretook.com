import type { ReactNode } from "react";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { PlannerTodo } from "~/lib/todos/plannerTodos";
import type { TodoTickProgress } from "~/components/todos";

import { canCompleteTodo } from "@caretook/data/schema";
import { ListTodo, UserRound } from "lucide-react";
import { Link } from "react-router";
import { TodoPartOf, TodoProgressMark, TodoRepeatMark, TodoTick, useTodoTick } from "~/components/todos";
import { Badge, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { assigneeLabel, dueText } from "~/lib/todos/todoDisplay";

/**
 * One open dated todo on the Planner tab, laid out like an event card
 * (`UpcomingRow`, B-636): its tick on the left (for whoever may complete it:
 * writers, or the viewer it's assigned to; a todo icon otherwise), where an
 * event has its kind icon; then its time on one line (the due time,
 * wall-clock in the recipient's zone, "All day", or "Overdue") with the
 * repeat mark, the title under it, and the due line when it's overdue; the
 * assignee pill on the right, at the bottom, where an event has its author.
 * The row opens the todo's page. Ticking completes it (Undo in the list's
 * `TodoUndoStatus`), and it drops out. It's never an entry. A parent shows
 * "n of m done" by its time, and its tick waits on open subtasks; a listed
 * subtask shows "Part of <parent>" under its title (todo-subtasks-2).
 */
export function PlannerTodoRow({
  item,
  nameOf,
  timeZone,
  now,
  tags,
  progress,
  parent,
}: {
  item: PlannerTodo<LocalTodo>;
  /** A member's name ("you" for me). */
  nameOf: (userId: string) => string;
  /** The recipient's zone. */
  timeZone: string;
  now: Date;
  /** Its tags' chips (tags PRD). */
  tags?: ReactNode;
  /** A parent's subtask progress (the list's one progress query). */
  progress?: TodoTickProgress;
  /** A subtask's parent, for "Part of". */
  parent?: { id: string; title: string };
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
      className="relative isolate grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 px-3 py-2"
      data-planner-todo={todo.id}
      data-todo-state={state}
    >
      <Link
        to={appUrls.todo(group.id, todo.id)}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open todo ${title}, ${due}`}
        data-planner-todo-open
      />
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
        {mayTick ? (
          <TodoTick
            title={title}
            done={false}
            disabled={tick.busy}
            progress={progress}
            showCount={false}
            onChange={(done) => void (done ? tick.complete({ id: todo.id, title }) : tick.reopen(todo))}
          />
        ) : (
          <ListTodo className="text-muted size-5" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <p
          className={`flex items-center gap-1 text-sm whitespace-nowrap tabular-nums ${overdue ? "text-error-ink font-semibold" : "text-muted"}`}
          data-when-line
        >
          <span data-when>{when}</span>
          <TodoRepeatMark todo={todo} />
          <TodoProgressMark progress={progress} className="text-muted font-normal" />
        </p>
        <p className="font-semibold break-words" data-todo-title>
          {title}
        </p>
        {/* Above the row's link, so its own link opens the parent. */}
        <TodoPartOf groupId={group.id} parent={parent} className="text-muted relative z-10 block text-sm" />
        {tags}
        {overdue && due && (
          <p className="text-error-ink text-sm" data-todo-due>
            {due}
          </p>
        )}
        {tick.error && (
          <Message tone="error" className="relative z-10">
            {tick.error}
          </Message>
        )}
      </div>
      {/* A long name wraps inside the side column rather than squeezing the title. */}
      <div className="flex max-w-[8rem] flex-col items-end" data-todo-side>
        <Badge
          icon={assignee.type === "name" ? UserRound : undefined}
          className="mt-auto h-auto max-w-full py-0.5 [&>svg]:shrink-0"
          data-todo-assignee={assignee.type}
        >
          <span className="min-w-0 break-words">{assignee.label}</span>
        </Badge>
      </div>
    </li>
  );
}

import type { LocalTask, TaskLink } from "~/lib/tasks/tasks.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { Plus, UserRound } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { linkOf } from "~/lib/tasks/tasks.sync";
import { assigneeLabel, dueText } from "~/lib/tasks/taskDisplay";
import { TASK_SHEET_STATE } from "~/lib/tasks/taskSheetLink";
import { TaskTick } from "./TaskTick";
import { TaskUndoStatus } from "./TaskUndoStatus";
import { useLinkedTasks } from "./useLinkedTasks";
import { useTaskTick } from "./useTaskTick";

/**
 * The open tasks linked to this provider, medication or appointment (tasks
 * PRD): each with its tick (for whoever may complete it; Undo for about
 * 10 s), its title opening the task, its due line and assignee. Hidden when
 * there are none, apart from writers' "Add task", which opens the add
 * sheet with the link filled in (and comes back here when it closes).
 */
export function LinkedTasks({ link, className = "" }: { link: TaskLink; className?: string }) {
  const group = useGroup();
  const { tasks, nameOf, now, timeZone, ticked, shown } = useLinkedTasks(link);
  const { complete, reopen, busy, error } = useTaskTick(group.id);
  const { field, id } = linkOf(link);
  if (!shown && !group.canWrite) return null;

  const add = group.canWrite && (
    <Link
      to={appUrls.newTask(group.id, { [field]: id })}
      // Closing the sheet comes back here.
      state={TASK_SHEET_STATE}
      prefetch="render"
      className="btn btn-ghost btn-sm gap-1"
      data-linked-tasks-add
    >
      <Plus className="size-4" aria-hidden="true" />
      Add task
    </Link>
  );
  if (!shown) return <div className={className}>{add}</div>;

  const tick = (task: LocalTask, done: boolean) => {
    if (done) ticked(task.id);
    void (done ? complete(task) : reopen(task));
  };
  return (
    <section aria-labelledby={`linked-tasks-${id}`} className={`space-y-2 ${className}`} data-linked-tasks="">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`linked-tasks-${id}`} className="font-semibold">
          Tasks
        </h2>
        {add}
      </div>
      {tasks.length > 0 && (
        <ul
          className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border px-3"
          aria-label="Open tasks"
        >
          {tasks.map((task) => {
            const state = todoState(task, now, timeZone);
            const assignee = assigneeLabel(task, nameOf);
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 py-2.5"
                data-task={task.id}
                data-task-state={state}
              >
                {canCompleteTodo({ role: group.role, userId: group.userId, todo: task }) ? (
                  <TaskTick
                    title={task.title}
                    done={!!task.doneAt}
                    disabled={busy}
                    onChange={(done) => tick(task, done)}
                  />
                ) : (
                  <span className="w-6 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    to={appUrls.task(group.id, task.id)}
                    className="link-hover block font-medium break-words"
                    data-task-title
                  >
                    {task.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span
                      className={state === "overdue" ? "text-error" : "text-base-content/70"}
                      data-task-due
                    >
                      {dueText(task, now, timeZone)}
                    </span>
                    <span
                      className="badge badge-ghost badge-sm gap-1 whitespace-nowrap"
                      data-task-assignee={assignee.type}
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
      <TaskUndoStatus groupId={group.id} />
      {error && <p className="text-error text-sm">{error}</p>}
    </section>
  );
}

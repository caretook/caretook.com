import type { LocalTask } from "~/lib/sync/tasks";
import type { UpcomingTask } from "~/lib/upcomingTasks";

import { canCompleteTask } from "@caretook/data/schema";
import { ListTodo, UserRound } from "lucide-react";
import { Link } from "react-router";
import { TaskTick, useTaskTick } from "~/components/tasks";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { assigneeLabel, dueText } from "~/lib/taskDisplay";

/**
 * One open dated task in Upcoming: its tick (for whoever may complete it:
 * writers, or the viewer it's assigned to; a task icon otherwise), its time
 * (the due time, wall-clock in the recipient's zone, "All day", or
 * "Overdue"), the title, the due line when it's overdue, and the assignee.
 * The row opens the task's page. Ticking completes it (Undo in the list's
 * `TaskUndoStatus`), and it drops out. It's never an entry.
 */
export function UpcomingTaskRow({
  item,
  nameOf,
  timeZone,
  now,
}: {
  item: UpcomingTask<LocalTask>;
  /** A member's name ("you" for me). */
  nameOf: (userId: string) => string;
  /** The recipient's zone. */
  timeZone: string;
  now: Date;
}) {
  const group = useGroup();
  const { task, state } = item;
  const { title } = task;
  const tick = useTaskTick(group.id);
  const mayTick = canCompleteTask({ role: group.role, userId: group.userId, task });
  const overdue = state === "overdue";
  const when = overdue ? "Overdue" : (task.dueTime ?? "All day");
  const due = dueText(task, now, timeZone);
  const assignee = assigneeLabel(task, nameOf);

  return (
    <li
      className="relative isolate flex items-start gap-2.5 px-3 py-2"
      data-upcoming-task={task.id}
      data-task-state={state}
    >
      <Link
        to={appUrls.task(group.id, task.id)}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open task ${title}, ${due}`}
        data-upcoming-task-open
      />
      {mayTick ? (
        <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
          <TaskTick
            title={title}
            done={false}
            disabled={tick.busy}
            onChange={(done) => void (done ? tick.complete({ id: task.id, title }) : tick.reopen(task))}
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
        <p className="font-medium break-words" data-task-title>
          {title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {overdue && due && (
            <span className="text-error" data-task-due>
              {due}
            </span>
          )}
          <span
            className="badge badge-ghost badge-sm gap-1 whitespace-nowrap"
            data-task-assignee={assignee.type}
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

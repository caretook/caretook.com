import type { LocalTask } from "~/lib/sync/tasks";

import { canCompleteTask, taskState } from "@caretook/data/schema";
import { UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { TaskTick } from "~/components/tasks";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { assigneeLabel, doneText, dueText } from "~/lib/taskDisplay";
import { taskPageState } from "~/lib/taskSheets";

const ASSIGNEE_CHIP = "badge badge-ghost badge-sm gap-1 whitespace-nowrap";

/**
 * One task: its tick (for whoever may complete it), the title (opening the
 * task's page, for everyone), the due line (red when overdue) or the done
 * line, and the assignee chip.
 */
export function TaskRow({
  task,
  nameOf,
  now,
  timeZone,
  onTick,
  busy,
}: {
  task: LocalTask;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  onTick: (task: LocalTask, done: boolean) => void;
  busy: boolean;
}) {
  const group = useGroup();
  const { search } = useLocation();
  const mayTick = canCompleteTask({ role: group.role, userId: group.userId, task });
  const state = taskState(task, now, timeZone);
  const assignee = assigneeLabel(task, nameOf);
  const line = task.doneAt ? doneText(task, nameOf, now, timeZone) : dueText(task, now, timeZone);

  return (
    <li className="flex items-start gap-3 py-2.5" data-task={task.id} data-task-state={state}>
      {mayTick ? (
        <TaskTick
          title={task.title}
          done={!!task.doneAt}
          disabled={busy}
          onChange={(done) => onTick(task, done)}
        />
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          to={appUrls.task(group.id, task.id)}
          // The page's way back keeps the list's chip.
          state={taskPageState(search)}
          className={`link-hover block font-medium break-words ${task.doneAt ? "text-base-content/60 line-through" : ""}`}
          data-task-title
        >
          {task.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {line && (
            <span className={state === "overdue" ? "text-error" : "text-base-content/70"} data-task-due>
              {line}
            </span>
          )}
          <span className={ASSIGNEE_CHIP} data-task-assignee={assignee.type}>
            {assignee.type === "name" && <UserRound className="size-3" aria-hidden="true" />}
            {assignee.label}
          </span>
        </p>
      </div>
    </li>
  );
}

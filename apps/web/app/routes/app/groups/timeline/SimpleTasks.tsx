import type { LocalTask } from "~/lib/tasks/tasks.sync";

import { canCompleteTask, taskState } from "@caretook/data/schema";
import { Link } from "react-router";
import { TaskTick, TaskUndoStatus, useTaskTick } from "~/components/tasks";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { dueText } from "~/lib/tasks/taskDisplay";
import { STALE } from "./layout";
import { useSimpleTasks } from "./useSimpleTasks";

/**
 * Simple mode's "My tasks" card (tasks PRD): my open tasks, overdue and
 * today first, at most five, each with a big tick (Undo for about 10 s),
 * and "See all" to the Tasks list on Mine. Viewers get it too (they may
 * complete what they were given). Nothing when I have none. Not a tile:
 * the tiles open entry forms.
 *
 * It never pops in (the tile cache): tasks remembered from earlier this
 * session paint at once, dimmed (`data-stale`, ticks off) until the device
 * confirms them; on a first visit a skeleton holds its place.
 */
export function SimpleTasks({ className = "" }: { className?: string }) {
  const group = useGroup();
  const { tasks, total, shown, ready, fresh, now, timeZone } = useSimpleTasks(group.id);
  const { complete, reopen, busy, error } = useTaskTick(group.id);
  if (!ready)
    return (
      <div
        className={`skeleton rounded-box h-32 ${className}`}
        aria-hidden="true"
        data-simple-skeleton="tasks"
      />
    );
  if (!shown) return null;

  const tick = (task: LocalTask, done: boolean) => void (done ? complete(task) : reopen(task));
  return (
    <section
      aria-label="My tasks"
      className={`space-y-3 ${fresh ? "" : STALE} ${className}`}
      data-simple-tasks=""
      data-stale={fresh ? undefined : ""}
    >
      <h2 className="text-2xl font-semibold">My tasks</h2>
      {tasks.length > 0 && (
        <ul className="space-y-1" aria-label="My open tasks">
          {tasks.map((task) => {
            const state = taskState(task, now, timeZone);
            return (
              <li
                key={task.id}
                className="flex items-center gap-4 py-2"
                data-simple-task={task.id}
                data-task-state={state}
              >
                {canCompleteTask({ role: group.role, userId: group.userId, task }) ? (
                  <TaskTick
                    title={task.title}
                    done={!!task.doneAt}
                    disabled={busy || !fresh}
                    large
                    onChange={(done) => tick(task, done)}
                  />
                ) : (
                  <span className="size-8 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-medium break-words" data-task-title>
                    {task.title}
                  </p>
                  <p
                    className={`text-base ${state === "overdue" ? "text-error" : "text-base-content/70"}`}
                    data-task-due
                  >
                    {dueText(task, now, timeZone)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TaskUndoStatus groupId={group.id} className="text-base" />
      {error && <p className="text-error text-base">{error}</p>}
      <p className="text-xl">
        <Link to={appUrls.tasks(group.id, "?who=mine")} className="link" data-simple-tasks-all="">
          {total > tasks.length ? `See all ${total} tasks` : "See all"}
        </Link>
      </p>
    </section>
  );
}

import type { LocalTask } from "~/lib/tasks/tasks.sync";

import { todoState } from "@caretook/data/schema";
import { assigneeText, doneByLine, dueLines } from "./taskPage";

/**
 * Who the task is for, when it's due (with the overdue or due line while
 * open, and the zone note when the device is elsewhere), and who finished it.
 */
export function TaskDetails({
  task,
  nameOf,
  now,
  timeZone,
  zoneNote,
}: {
  task: LocalTask;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  zoneNote: string | null;
}) {
  const due = dueLines(task, now, timeZone);
  const doneBy = doneByLine(task, nameOf, now, timeZone);
  const overdue = todoState(task, now, timeZone) === "overdue";
  return (
    <section aria-label="Details" className="space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-base-content/70">Assigned to</dt>
        <dd data-task-assignee>{assigneeText(task, nameOf)}</dd>
        <dt className="text-base-content/70">Due</dt>
        <dd data-task-due>
          <span>{due.day}</span>
          {due.status && (
            <span className={`block ${overdue ? "text-error" : "text-base-content/70"}`}>{due.status}</span>
          )}
          {task.dueTime && zoneNote && <span className="text-base-content/70 block">{zoneNote}</span>}
        </dd>
      </dl>
      {doneBy && (
        <p className="text-success text-sm font-medium" data-task-done-by>
          {doneBy}
        </p>
      )}
    </section>
  );
}

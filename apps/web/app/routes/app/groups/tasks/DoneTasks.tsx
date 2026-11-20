import type { LocalTask } from "~/lib/tasks/tasks.sync";

import { TaskRow } from "./TaskRow";

type RowProps = Omit<Parameters<typeof TaskRow>[0], "task">;

/**
 * Done, below the open tasks: newest first, a page at a time. Unticking
 * one (for whoever may complete it) reopens it.
 */
export function DoneTasks({
  tasks,
  more,
  onMore,
  ...row
}: { tasks: LocalTask[]; more: boolean; onMore: () => void } & RowProps) {
  if (!tasks.length) return null;
  return (
    <section aria-labelledby="tasks-done" className="border-base-300 border-t pt-4" data-task-section="done">
      <h2 id="tasks-done" className="text-base-content/70 text-sm font-semibold">
        Done
      </h2>
      <ul className="divide-base-300 divide-y">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} {...row} />
        ))}
      </ul>
      {more && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={onMore} data-done-more>
          Show more
        </button>
      )}
    </section>
  );
}

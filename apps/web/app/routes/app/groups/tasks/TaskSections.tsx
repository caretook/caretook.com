import type { LocalTask } from "~/lib/tasks/tasks.sync";
import type { TaskSection } from "~/lib/tasks/taskList";

import { TaskRow } from "./TaskRow";

type RowProps = Omit<Parameters<typeof TaskRow>[0], "task">;

/** The open tasks, in sections (Overdue, Today, a day per later day, No due date). */
export function TaskSections({
  sections,
  empty,
  ...row
}: { sections: TaskSection<LocalTask>[]; empty: string } & RowProps) {
  if (!sections.length)
    return (
      <p className="text-base-content/70 py-6 text-center text-sm" data-tasks-empty>
        {empty}
      </p>
    );
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`tasks-${section.key}`} data-task-section={section.key}>
          <h2
            id={`tasks-${section.key}`}
            className={`text-sm font-semibold ${section.key === "overdue" ? "text-error" : "text-base-content/70"}`}
          >
            {section.label}
          </h2>
          <ul className="divide-base-300 divide-y">
            {section.tasks.map((task) => (
              <TaskRow key={task.id} task={task} {...row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

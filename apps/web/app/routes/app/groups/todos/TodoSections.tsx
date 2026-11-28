import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { TodoSection } from "~/lib/todos/todoList";

import { EmptyState, TITLE_SUB } from "~/components/ui";
import { TodoTree } from "~/components/todos";

type TreeProps = Omit<
  Parameters<typeof TodoTree>[0],
  "trees" | "look" | "adding" | "ancestors" | "className"
>;

/**
 * The open trees, in sections (Overdue, Today, a day per later day, No due
 * date): the shared `TodoTree`, each row with its quick add (writers only;
 * `TodoQuickAdd` decides).
 */
export function TodoSections({
  sections,
  empty,
  ...row
}: {
  sections: TodoSection<LocalTodo>[];
  empty: string;
} & TreeProps) {
  if (!sections.length) return <EmptyState data-todos-empty="">{empty}</EmptyState>;
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`todos-${section.key}`} data-todo-section={section.key}>
          <h2
            id={`todos-${section.key}`}
            className={`${TITLE_SUB} ${section.key === "overdue" ? "text-error-ink" : "text-muted"}`}
          >
            {section.label}
          </h2>
          <TodoTree trees={section.trees} adding className="divide-base-300 divide-y" {...row} />
        </section>
      ))}
    </div>
  );
}

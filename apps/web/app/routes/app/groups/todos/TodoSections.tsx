import type { SectionAccent } from "~/lib/app-shell/sectionAccents";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { TodoSection } from "~/lib/todos/todoList";

import { EmptyState } from "~/components/ui";
import { TodoRow } from "./TodoRow";

type RowProps = Omit<Parameters<typeof TodoRow>[0], "todo">;

/** The open todos, in sections (Overdue, Today, a day per later day, No due date). */
export function TodoSections({
  sections,
  empty,
  emptyMark,
  ...row
}: {
  sections: TodoSection<LocalTodo>[];
  empty: string;
  /** The section's icon and accent for an unfiltered empty list; without it, a quiet line. */
  emptyMark?: SectionAccent;
} & RowProps) {
  if (!sections.length)
    return emptyMark ? (
      <EmptyState {...emptyMark} data-todos-empty="">
        {empty}
      </EmptyState>
    ) : (
      <p className="text-base-content/70 py-6 text-center text-sm" data-todos-empty>
        {empty}
      </p>
    );
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`todos-${section.key}`} data-todo-section={section.key}>
          <h2
            id={`todos-${section.key}`}
            className={`text-sm font-semibold ${section.key === "overdue" ? "text-error" : "text-base-content/70"}`}
          >
            {section.label}
          </h2>
          <ul className="divide-base-300 divide-y">
            {section.todos.map((todo) => (
              <TodoRow key={todo.id} todo={todo} {...row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

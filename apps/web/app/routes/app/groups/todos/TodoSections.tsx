import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { TodoSection } from "~/lib/todos/todoList";

import { EmptyState, TITLE_SUB } from "~/components/ui";
import { TodoRow } from "~/components/todos";

type RowProps = Omit<Parameters<typeof TodoRow>[0], "todo">;

/** The open todos, in sections (Overdue, Today, a day per later day, No due date). */
export function TodoSections({
  sections,
  empty,
  ...row
}: {
  sections: TodoSection<LocalTodo>[];
  empty: string;
} & RowProps) {
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

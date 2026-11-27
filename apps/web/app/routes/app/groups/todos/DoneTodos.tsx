import type { LocalTodo } from "~/lib/todos/todos.sync";

import { Button, TITLE_SUB } from "~/components/ui";
import { TodoRow } from "~/components/todos";

type RowProps = Omit<Parameters<typeof TodoRow>[0], "todo">;

/**
 * Done, below the open todos: newest first, a page at a time. Unticking
 * one (for whoever may complete it) reopens it.
 */
export function DoneTodos({
  todos,
  more,
  onMore,
  ...row
}: { todos: LocalTodo[]; more: boolean; onMore: () => void } & RowProps) {
  if (!todos.length) return null;
  return (
    <section aria-labelledby="todos-done" className="border-base-300 border-t pt-4" data-todo-section="done">
      <h2 id="todos-done" className={`${TITLE_SUB} text-muted`}>
        Done
      </h2>
      <ul className="divide-base-300 divide-y">
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} {...row} />
        ))}
      </ul>
      {more && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onMore} data-done-more="">
          Show more
        </Button>
      )}
    </section>
  );
}

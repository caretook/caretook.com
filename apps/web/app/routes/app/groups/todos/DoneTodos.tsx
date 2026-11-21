import type { LocalTodo } from "~/lib/todos/todos.sync";

import { TodoRow } from "./TodoRow";

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
      <h2 id="todos-done" className="text-base-content/70 text-sm font-semibold">
        Done
      </h2>
      <ul className="divide-base-300 divide-y">
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} {...row} />
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

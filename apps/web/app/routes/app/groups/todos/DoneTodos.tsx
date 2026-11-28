import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { TodoTree as Tree } from "~/lib/todos/todoTreeView";

import { Button, TITLE_SUB } from "~/components/ui";
import { TodoTree } from "~/components/todos";

type TreeProps = Omit<
  Parameters<typeof TodoTree>[0],
  "trees" | "look" | "adding" | "ancestors" | "className"
>;

/**
 * Done, below the open todos (B-1016): the open list's shared `TodoTree`, a
 * done todo with its done subtasks nested under it, newest completion first,
 * a page of whole trees at a time (`doneTreePage`). A done subtask of an open
 * tree is struck in that tree, not here. Unticking one (for whoever may
 * complete it) reopens it. No quick add: a subtask goes on an open todo.
 */
export function DoneTodos({
  trees,
  more,
  onMore,
  ...row
}: { trees: readonly Tree<LocalTodo>[]; more: boolean; onMore: () => void } & TreeProps) {
  if (!trees.length) return null;
  return (
    <section aria-labelledby="todos-done" className="border-base-300 border-t pt-4" data-todo-section="done">
      <h2 id="todos-done" className={`${TITLE_SUB} text-muted`}>
        Done
      </h2>
      <TodoTree trees={trees} className="divide-base-300 divide-y" {...row} />
      {more && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onMore} data-done-more="">
          Show more
        </Button>
      )}
    </section>
  );
}

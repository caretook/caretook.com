import type { QuickAddParent } from "./TodoQuickAdd";
import type { TodoRowLook } from "./TodoRow";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { TodoTreeNode } from "~/lib/todos/todoTreeView";

import { TodoQuickAdd } from "./TodoQuickAdd";
import { TodoRow } from "./TodoRow";

type RowProps = Omit<Parameters<typeof TodoRow>[0], "todo" | "look" | "addSubtask" | "children">;

/**
 * The one tree display (todo-subtasks-3): `trees` (`todoTrees`,
 * `todoDayTrees`) as nested `TodoRow`s in the row's `look`, a list per level,
 * each level indented to the row's text. A node marked `context` shows in
 * the `context` look. With `adding`, each row that may take a subtask has
 * its compact `TodoQuickAdd` (not a context row: it's there only to place
 * its branch). `ancestors` is the chain above the trees' top level (for a
 * `rootId` tree: the root and its own ancestors), so depth holds. The
 * `card` look (the Planner) is the top level's only: the steps under a card
 * are the `list` look, indented to its text. The `easy` look (easy mode)
 * is every level's, but a context row's.
 */
export function TodoTree({
  trees,
  look = "list",
  adding = false,
  ancestors = [],
  className = "",
  ...row
}: {
  trees: readonly TodoTreeNode<LocalTodo>[];
  look?: Exclude<TodoRowLook, "context">;
  /** Each row offers its quick add (writers; where a subtask may go). */
  adding?: boolean;
  ancestors?: readonly QuickAddParent[];
  /** Classes for the top level's list. */
  className?: string;
} & RowProps) {
  const level = (nodes: readonly TodoTreeNode<LocalTodo>[], above: readonly QuickAddParent[], top: boolean) =>
    nodes.map((node) => {
      const nodeLook = node.context ? "context" : look === "card" && !top ? "list" : look;
      return (
        <TodoRow
          key={node.todo.id}
          todo={node.todo}
          look={nodeLook}
          addSubtask={
            adding && !node.context ? (
              <TodoQuickAdd parent={node.todo} ancestors={above} form="compact" inline className="mt-1" />
            ) : undefined
          }
          {...row}
        >
          {node.children.length > 0 && (
            // To the row's text: under a card px-3, the size-6 tick and gap-x-2.5; an
            // easy row's size-8 tick and gap-4 (none without ticks); a list row's w-6 and gap-3.
            <ul
              className={
                nodeLook === "card"
                  ? "pr-3 pl-[2.875rem]"
                  : nodeLook === "easy"
                    ? row.onTick
                      ? "pl-12"
                      : "pl-6"
                    : "pl-9"
              }
              data-todo-level={above.length + 2}
            >
              {level(node.children, [node.todo, ...above], false)}
            </ul>
          )}
        </TodoRow>
      );
    });

  return (
    <ul className={className} data-todo-tree="" data-todo-level={ancestors.length + 1}>
      {level(trees, ancestors, true)}
    </ul>
  );
}

import type { TodoTree, TodoTreeNode, TreeTodo } from "../../../../lib/todos/todoTreeView";

import { showsTodo } from "../../../../lib/todos/todoList";
import { todoTrees } from "../../../../lib/todos/todoTreeView";

// Easy mode's "My todos" (`useEasyTodos`), pure so web:unit tests it.

/** How many of my todos easy mode's card shows; "See all" opens the rest (the easy roles get them all). */
export const EASY_TODOS_CAP = 5;

/** One of mine: open and assigned to me (the Mine chip's rule, `showsTodo`). */
const isMine = (todo: TreeTodo, userId: string) => !todo.doneAt && showsTodo("mine", todo, userId);

const mineIn = <T extends TreeTodo>(node: TodoTreeNode<T>, userId: string): number =>
  (!node.context && isMine(node.todo, userId) ? 1 : 0) +
  node.children.reduce((n, child) => n + mineIn(child, userId), 0);

/**
 * The card's trees (todo-subtasks-3): from the trees' rows (`todoTreesQuery`),
 * my open todos as `todoTrees` with "mine" as the match, so an assigned step
 * shows under its ancestors as context rows and its siblings that aren't
 * mine are left out (a todo of mine keeps its whole subtree). `total` is how
 * many of mine there are; with `cap`, trees are taken in list order until
 * `cap` of mine show, a tree never cut midway (the one reaching the cap shows
 * whole, the next waits for "See all"). `shown` counts mine in those trees.
 */
export const easyTodoTrees = <T extends TreeTodo>(
  todos: readonly T[],
  { userId, now, timeZone, cap }: { userId: string; now: Date | number; timeZone: string; cap?: number },
): { trees: TodoTree<T>[]; total: number; shown: number } => {
  const all = todoTrees(todos, { now, timeZone, matches: (todo) => isMine(todo, userId) });
  const counts = all.map((tree) => mineIn(tree, userId));
  const total = counts.reduce((n, c) => n + c, 0);
  const trees: TodoTree<T>[] = [];
  let shown = 0;
  for (const [i, tree] of all.entries()) {
    if (cap !== undefined && shown >= cap) break;
    trees.push(tree);
    shown += counts[i]!;
  }
  return { trees, total, shown };
};

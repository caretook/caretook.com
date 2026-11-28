import type { TodoRuleFields } from "@caretook/data/domain";
import { doneOrder, MAX_TODO_DEPTH, siblingOrder, todoOrder, todoState } from "@caretook/data/domain";

// The one tree display's shape (todo-subtasks-3; pure, web:unit tests it):
// every list of todos shows a subtask only inside its tree. `todoTrees`
// builds the trees from a list's rows (one live query, never one per row)
// and a match predicate; `todoDayTrees` cuts them for one day of the day
// views. The tree rules (`siblingOrder`, `todoOrder`) come from the data
// package; nothing here re-derives an order.

/** What a tree needs of a todo. Device rows fit. */
export type TreeTodo = TodoRuleFields & { parentId?: string | null; deletedAt?: string | null };

/** One todo in a tree, its subtasks below it in `siblingOrder`. */
export type TodoTreeNode<T> = {
  todo: T;
  /** Kept only to place a match (or a day's step) below it: shown in the `context` look. */
  context: boolean;
  children: TodoTreeNode<T>[];
};

/** A tree as a list shows it. */
export type TodoTree<T> = TodoTreeNode<T> & {
  /**
   * The open todo that places the tree in its list (`todoOrder`): its most
   * urgent shown one, or on a day the most urgent step due then. Null when
   * nothing shown is open.
   */
  lead: T | null;
};

type Options<T> = {
  now: Date | number;
  timeZone: string;
  /** Which todos the list wants (a filter, a search); default all. A match keeps its subtree and its ancestors. */
  matches?: (todo: T) => boolean;
  /** Build only this todo's descendants: the trees of its subtasks, in `siblingOrder`. */
  rootId?: string;
};

const openShown = <T extends TreeTodo>(node: TodoTreeNode<T>, into: T[] = []): T[] => {
  if (!node.context && !node.todo.doneAt) into.push(node.todo);
  for (const child of node.children) openShown(child, into);
  return into;
};

/**
 * The trees in list order. Deleted todos are left out; a todo whose parent
 * isn't in `todos` stands as a top-level one. Siblings go by `siblingOrder`,
 * done ones in place. With `matches`, a todo that matches keeps its whole
 * subtree, its ancestors stay as context, and branches with no match are
 * dropped. Each tree is placed by its most urgent open shown todo
 * (`todoOrder`: an overdue subtask puts its tree under Overdue); trees with
 * nothing open come last. With `rootId`, one todo's subtasks' trees, in
 * `siblingOrder` (they're siblings).
 */
export const todoTrees = <T extends TreeTodo>(
  todos: readonly T[],
  { now, timeZone, matches, rootId }: Options<T>,
): TodoTree<T>[] => {
  const live = todos.filter((t) => !t.deletedAt);
  const ids = new Set(live.map((t) => t.id));
  const childrenOf = new Map<string, T[]>();
  const tops: T[] = [];
  for (const todo of live) {
    const parentId = todo.parentId;
    if (parentId && (ids.has(parentId) || parentId === rootId)) {
      const list = childrenOf.get(parentId);
      if (list) list.push(todo);
      else childrenOf.set(parentId, [todo]);
    } else tops.push(todo);
  }

  const build = (todo: T, inMatch: boolean): TodoTreeNode<T> | null => {
    const hit = inMatch || !matches || matches(todo);
    const children = siblingOrder(childrenOf.get(todo.id) ?? [])
      .map((child) => build(child, hit))
      .filter((child) => child !== null);
    if (!hit && !children.length) return null;
    return { todo, context: !hit, children };
  };

  const roots = siblingOrder(rootId ? (childrenOf.get(rootId) ?? []) : tops);
  const trees = roots
    .map((todo) => build(todo, false))
    .filter((node) => node !== null)
    .map((node) => ({ ...node, lead: todoOrder(openShown(node), now, timeZone)[0] ?? null }));
  if (rootId) return trees;

  const byLead = new Map(trees.flatMap((tree) => (tree.lead ? [[tree.lead.id, tree] as const] : [])));
  return [
    ...todoOrder(
      trees.flatMap((tree) => (tree.lead ? [tree.lead] : [])),
      now,
      timeZone,
    ).map((lead) => byLead.get(lead.id)!),
    ...trees.filter((tree) => !tree.lead),
  ];
};

/**
 * Subtasks on their own (todo-links-2): every live, open todo that matches
 * as a tree of its own (no children, not context, its own lead), in
 * `todoOrder`, so each is placed by its own due. Done and deleted todos are
 * left out, and a match keeps no ancestors (there's no tree to place it in).
 * The shape is `todoTrees`', so `todoSections` and `todoDayTrees` take it.
 */
export const splitTrees = <T extends TreeTodo>(
  todos: readonly T[],
  { now, timeZone, matches }: Omit<Options<T>, "rootId">,
): TodoTree<T>[] =>
  todoOrder(
    todos.filter((t) => !t.deletedAt && !t.doneAt && (!matches || matches(t))),
    now,
    timeZone,
  ).map((todo) => ({ todo, context: false, children: [], lead: todo }));

/** The newest `doneAt` among a node's shown (not context) todos, "" if none. */
const newestDone = <T extends TreeTodo>(node: TodoTreeNode<T>): string =>
  node.children.reduce(
    (newest, child) => {
      const at = newestDone(child);
      return at > newest ? at : newest;
    },
    node.context ? "" : (node.todo.doneAt ?? ""),
  );

/**
 * The Done list's page (B-1016): `todos` are done rows, built into the one
 * tree display like the open list (`todoTrees`, with the same `matches`), a
 * done top-level todo with its done subtasks under it. A done subtask whose
 * parent isn't in `todos` (still open: it shows struck in its open tree) is
 * left out, and so is its branch. Trees go newest completion first (the
 * newest `doneAt` they show; ties by id) and a page holds whole trees: the
 * first `limit`, with `more` when there are others. With `split` (subtasks
 * on their own, todo-links-2) every done todo that matches is its own tree,
 * in `doneOrder`.
 */
export const doneTreePage = <T extends TreeTodo>(
  todos: readonly T[],
  {
    now,
    timeZone,
    matches,
    split = false,
    limit,
  }: Omit<Options<T>, "rootId"> & { split?: boolean; limit: number },
): { trees: TodoTree<T>[]; more: boolean } => {
  const live = todos.filter((t) => !t.deletedAt && t.doneAt);
  let trees: TodoTree<T>[];
  if (split) {
    trees = doneOrder(live.filter((t) => !matches || matches(t))).map((todo) => ({
      todo,
      context: false,
      children: [],
      lead: null,
    }));
  } else {
    const byId = new Map(live.map((t) => [t.id, t]));
    // Listed when its whole chain up to a top-level todo is here (and done).
    const listed = (todo: T, depth = 0): boolean =>
      !todo.parentId ||
      (depth < MAX_TODO_DEPTH && !!byId.get(todo.parentId) && listed(byId.get(todo.parentId)!, depth + 1));
    const rank = todoTrees(
      live.filter((t) => listed(t)),
      { now, timeZone, matches },
    ).map((tree) => ({ tree, at: newestDone(tree) }));
    trees = rank
      .sort((a, b) => (a.at !== b.at ? (a.at < b.at ? 1 : -1) : a.tree.todo.id < b.tree.todo.id ? -1 : 1))
      .map(({ tree }) => tree);
  }
  return { trees: trees.slice(0, limit), more: trees.length > limit };
};

/**
 * A todo's ancestor chain (its parent, the parent's parent, …, up to the
 * top) from the rows a list read (`parentOf`), for a split row's quick add
 * (todo-links-2, B-994): on its own it's a top row, but its depth is its
 * tree's. The walk stops at a parent the rows don't have, and never goes
 * past `MAX_TODO_DEPTH`.
 */
export const ancestorChain = <P extends { parentId?: string | null }>(
  todo: { parentId?: string | null },
  parentOf: (parentId: string) => P | undefined,
): P[] => {
  const chain: P[] = [];
  let parentId = todo.parentId;
  while (parentId && chain.length < MAX_TODO_DEPTH) {
    const parent = parentOf(parentId);
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
};

/** The day view a todo is due in: "overdue", its due day, or null (done or undated). */
export const todoDayOf = (todo: TreeTodo, now: Date | number, timeZone: string) => {
  const state = todoState(todo, now, timeZone);
  if (state === "done" || state === "undated") return null;
  return state === "overdue" ? "overdue" : todo.dueOn;
};

/**
 * `trees` (from `todoTrees`) cut for one day of the day views: `day` is a
 * "YYYY-MM-DD" or "overdue". On the top-level todo's own day (under Overdue
 * when it's overdue) the whole tree; otherwise the branches of the open
 * steps due then (`todoDayOf`), each with its subtree, its ancestors as
 * context. An undated tree shows only its dated steps' branches; a tree with
 * nothing open due that day isn't there. A context row's day counts for
 * nothing: under a filter, a match due the same day as its unmatched parent
 * is its own branch, led (and ranked) by the match. Order is kept.
 */
export const todoDayTrees = <T extends TreeTodo>(
  trees: readonly TodoTree<T>[],
  day: string,
  now: Date | number,
  timeZone: string,
): TodoTree<T>[] => {
  // A context row (an ancestor kept for a match) is never due here: the lead
  // and the cut come from shown todos only (B-974).
  const dueThen = (node: TodoTreeNode<T>) => !node.context && todoDayOf(node.todo, now, timeZone) === day;
  return trees.flatMap((tree) => {
    if (dueThen(tree)) return [{ ...tree, lead: tree.todo }];
    const due: T[] = [];
    const cut = (node: TodoTreeNode<T>): TodoTreeNode<T> | null => {
      if (dueThen(node)) {
        due.push(node.todo);
        return node;
      }
      const children = node.children.map(cut).filter((child) => child !== null);
      return children.length ? { todo: node.todo, context: true, children } : null;
    };
    const branch = cut(tree);
    return branch ? [{ ...branch, lead: todoOrder(due, now, timeZone)[0] ?? null }] : [];
  });
};

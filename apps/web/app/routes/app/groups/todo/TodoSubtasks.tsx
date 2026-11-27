import type { QuickAddParent, TodoTickProgress } from "~/components/todos";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { useMemo } from "react";
import { Link } from "react-router";
import { mayAddSubtask, TodoQuickAdd, TodoTree, TodoUndoStatus, useTodoTick } from "~/components/todos";
import { LINK, Message, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { todoTrees } from "~/lib/todos/todoTreeView";

/**
 * The Subtasks band (todo-subtasks; the tree, todo-subtasks-3): "n of m
 * done" over the shared `TodoTree` of every live todo under this one
 * (children and grandchildren nested, done ones struck in place), each row
 * with its tick for whoever may complete it (a parent's waits on its own
 * open subtasks) and Undo for the shown ones, and for writers each row's
 * compact quick add where a subtask may go; then writers' "Add subtask"
 * field (the shared `TodoQuickAdd`, full) while the todo may take one. No
 * subtasks and no add: no band. The parent follows its children on the
 * device (the rollup), so the page shows it live.
 */
export function TodoSubtasks({
  todo,
  ancestors,
  chain,
  subtasks,
  descendants,
  progress,
  progressOf,
  nameOf,
  now,
  timeZone,
}: {
  todo: LocalTodo;
  /** The todo's ancestor chain, for whether it may take a subtask. */
  ancestors: readonly unknown[];
  /** The todo and its ancestors: the chain above the tree's top level. */
  chain: readonly QuickAddParent[];
  /** Its own live subtasks. */
  subtasks: LocalTodo[];
  /** Every live todo under it, from the page's one query. */
  descendants: LocalTodo[];
  progress: { done: number; total: number };
  /** Each todo's progress under it, from the same rows. */
  progressOf: ReadonlyMap<string, TodoTickProgress>;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
}) {
  const group = useGroup();
  const tick = useTodoTick(group.id);
  const trees = useMemo(
    () => todoTrees(descendants, { now, timeZone, rootId: todo.id }),
    [descendants, now, timeZone, todo.id],
  );
  const adding = mayAddSubtask(group.role, ancestors, todo);
  if (!subtasks.length && !adding) return null;

  return (
    <Section title="Subtasks" id="subtasks">
      {subtasks.length > 0 && (
        <>
          <p className="text-muted text-sm" data-subtask-progress>
            {progress.done} of {progress.total} done
          </p>
          <TodoTree
            trees={trees}
            adding={adding}
            ancestors={chain}
            className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border px-3"
            nameOf={nameOf}
            now={now}
            timeZone={timeZone}
            busy={tick.busy}
            onTick={(t, done) => void (done ? tick.complete(t) : tick.reopen(t))}
            progressOf={(id) => progressOf.get(id)}
          />
          <TodoUndoStatus groupId={group.id} todoIds={descendants.map((t) => t.id)} />
          {tick.error && <Message tone="error">{tick.error}</Message>}
        </>
      )}
      {adding && <TodoQuickAdd parent={todo} ancestors={ancestors} form="full" />}
    </Section>
  );
}

/** A subtask's way up: "Part of <parent>", linking to the parent's page. */
export function TodoParentLink({ groupId, parent }: { groupId: string; parent: LocalTodo | null }) {
  if (!parent) return null;
  return (
    <p className="text-muted text-sm" data-todo-parent>
      Part of{" "}
      <Link to={appUrls.todo(groupId, parent.id)} className={LINK}>
        {parent.title}
      </Link>
    </p>
  );
}

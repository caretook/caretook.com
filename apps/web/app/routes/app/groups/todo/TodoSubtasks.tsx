import type { TodoTickProgress } from "~/components/todos";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canCompleteTodo } from "@caretook/data/schema";
import { Link } from "react-router";
import { mayAddSubtask, TodoQuickAdd, TodoTick, TodoUndoStatus, useTodoTick } from "~/components/todos";
import { LINK, Message, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";

/**
 * The Subtasks band (todo-subtasks): each live subtask with its tick (for
 * whoever may complete it, with Undo as everywhere), its title opening its
 * page, "n of m done", and writers' inline "Add subtask" (the shared
 * `TodoQuickAdd`, full) while the todo may take one. A subtask with open subtasks of its own has a disabled tick
 * reading "n of m" (`progressOf`). No subtasks and no add: no band. The parent follows its
 * children on the device (the rollup), so the page shows it live.
 */
export function TodoSubtasks({
  todo,
  ancestors,
  subtasks,
  progress,
  progressOf,
}: {
  todo: LocalTodo;
  /** The todo's ancestor chain, for whether it may take a subtask. */
  ancestors: readonly unknown[];
  subtasks: LocalTodo[];
  progress: { done: number; total: number };
  /** Each subtask's own progress, from the group's one query. */
  progressOf: ReadonlyMap<string, TodoTickProgress>;
}) {
  const group = useGroup();
  const tick = useTodoTick(group.id);
  const adding = mayAddSubtask(group.role, ancestors, todo);
  if (!subtasks.length && !adding) return null;

  return (
    <Section title="Subtasks" id="subtasks">
      {subtasks.length > 0 && (
        <>
          <p className="text-muted text-sm" data-subtask-progress>
            {progress.done} of {progress.total} done
          </p>
          <ul
            className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border px-3"
            aria-label={`Subtasks of ${todo.title}`}
          >
            {subtasks.map((sub) => (
              <li key={sub.id} className="flex items-start gap-3 py-2.5" data-subtask={sub.id}>
                {canCompleteTodo({ role: group.role, userId: group.userId, todo: sub }) ? (
                  <TodoTick
                    title={sub.title}
                    done={!!sub.doneAt}
                    disabled={tick.busy}
                    progress={progressOf.get(sub.id)}
                    onChange={(done) => void (done ? tick.complete(sub) : tick.reopen(sub))}
                  />
                ) : (
                  <span className="w-6 shrink-0" aria-hidden="true" />
                )}
                <Link
                  to={appUrls.todo(group.id, sub.id)}
                  className={`link-hover min-w-0 flex-1 font-medium break-words ${sub.doneAt ? "text-muted line-through" : ""}`}
                  data-subtask-title
                >
                  {sub.title}
                </Link>
              </li>
            ))}
          </ul>
          <TodoUndoStatus groupId={group.id} todoIds={subtasks.map((s) => s.id)} />
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

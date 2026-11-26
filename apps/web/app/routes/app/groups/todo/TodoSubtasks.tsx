import type { FormEvent } from "react";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canCompleteTodo, isTodoWriter } from "@caretook/data/schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { TodoTick, TodoUndoStatus, useTodoTick } from "~/components/todos";
import { Button, Field, LINK, Message, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { createTodo } from "~/lib/todos/todos.sync";

/**
 * The Subtasks band (todo-subtasks): each live subtask with its tick (for
 * whoever may complete it, with Undo as everywhere), its title opening its
 * page, "n of m done", and writers' inline "Add subtask" while the todo may
 * take one. No subtasks and no add: no band. The parent follows its
 * children on the device (the rollup), so the page shows it live.
 */
export function TodoSubtasks({
  todoId,
  title,
  subtasks,
  progress,
  canAdd,
}: {
  todoId: string;
  title: string;
  subtasks: LocalTodo[];
  progress: { done: number; total: number };
  canAdd: boolean;
}) {
  const group = useGroup();
  const tick = useTodoTick(group.id);
  const adding = canAdd && isTodoWriter(group.role);
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
            aria-label={`Subtasks of ${title}`}
          >
            {subtasks.map((sub) => (
              <li key={sub.id} className="flex items-start gap-3 py-2.5" data-subtask={sub.id}>
                {canCompleteTodo({ role: group.role, userId: group.userId, todo: sub }) ? (
                  <TodoTick
                    title={sub.title}
                    done={!!sub.doneAt}
                    disabled={tick.busy}
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
      {adding && <AddSubtask groupId={group.id} parentId={todoId} />}
    </Section>
  );
}

/** A title field writing `createTodo` with this todo as the parent; it stays open for the next. */
function AddSubtask({ groupId, parentId }: { groupId: string; parentId: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    void createTodo(getSync(), groupId, { title, parentId })
      .then((result) => (result.ok ? setValue("") : setError(result.error)))
      .catch((err: unknown) => {
        console.error("Couldn't add the subtask", err);
        setError("Couldn't save that. Try again.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <form className="space-y-2" onSubmit={submit} data-subtask-add="">
      <div className="flex items-end gap-2">
        <Field label="New subtask" labelHidden kind="input" className="min-w-0 flex-1">
          {(control) => (
            <input
              {...control}
              type="text"
              placeholder="Add a subtask"
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
            />
          )}
        </Field>
        <Button type="submit" icon={Plus} disabled={!value.trim()} busy={busy} busyLabel="Adding…">
          Add subtask
        </Button>
      </div>
      {error && <Message tone="error">{error}</Message>}
    </form>
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

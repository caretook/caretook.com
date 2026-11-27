import type { FormEvent, KeyboardEvent } from "react";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canHaveSubtask, isTodoWriter } from "@caretook/data/schema";
import { ListPlus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button, Field, IconButton, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { createTodo } from "~/lib/todos/todos.sync";

/** What the quick add needs of the todo it adds under. */
export type QuickAddParent = Pick<LocalTodo, "id" | "title" | "deletedAt" | "repeatRule">;

/**
 * Whether this person may add a subtask to `parent` here: a writer, and the
 * todo may take one (`canHaveSubtask`: live, not repeating, within depth).
 * `ancestors` is the parent's own chain (its parent, …, up to the top).
 */
export const mayAddSubtask = (
  role: string | null | undefined,
  ancestors: readonly unknown[],
  parent: QuickAddParent,
) => isTodoWriter(role) && canHaveSubtask(ancestors, parent);

/**
 * The one way to add a subtask (todo-subtasks-3): a title field over
 * `createTodo` with `parent` as the parent. Enter adds and keeps the field
 * focused and open for the next; a failed write says so inline. `compact`
 * (a list row, a tree) is an icon-only "Add subtask to <title>" button that
 * opens the field in place, and Escape closes it; `full` (the todo page's
 * band) shows the field with its Add button. Nothing for a non-writer or a
 * todo that can't take a subtask.
 */
export function TodoQuickAdd({
  parent,
  ancestors,
  form,
  className = "",
}: {
  parent: QuickAddParent;
  ancestors: readonly unknown[];
  form: "compact" | "full";
  /** Classes for the outer element. */
  className?: string;
}) {
  const group = useGroup();
  const [open, setOpen] = useState(form === "full");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const formId = useId();
  if (!mayAddSubtask(group.role, ancestors, parent)) return null;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    void createTodo(getSync(), group.id, { title, parentId: parent.id })
      .then((result) => (result.ok ? setValue("") : setError(result.error)))
      .catch((err: unknown) => {
        console.error("Couldn't add the subtask", err);
        setError("Couldn't save that. Try again.");
      })
      .finally(() => setBusy(false));
  };

  const close = () => {
    setOpen(false);
    setValue("");
    setError(null);
    opener.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (form === "compact") close();
    else setValue("");
  };

  const compact = form === "compact";
  return (
    <div className={`space-y-2 ${className}`} data-todo-quick-add={form}>
      {compact && (
        // Its own gap from the row's other controls (`ml-1`), so a tap lands on it.
        <IconButton
          ref={opener}
          icon={ListPlus}
          label={`Add subtask to ${parent.title}`}
          expanded={open}
          controls={formId}
          className="ml-1"
          onPress={() => (open ? close() : setOpen(true))}
        />
      )}
      {open && (
        <form id={formId} className="space-y-2" onSubmit={submit} data-subtask-add="">
          <div className="flex items-end gap-2">
            <Field label="New subtask" labelHidden kind="input" className="min-w-0 flex-1">
              {(control) => (
                <input
                  {...control}
                  type="text"
                  placeholder="Add a subtask"
                  // Opened from its button: straight to typing.
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the person just asked for the field
                  autoFocus={compact}
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                  onKeyDown={onKeyDown}
                />
              )}
            </Field>
            {!compact && (
              <Button type="submit" icon={Plus} disabled={!value.trim()} busy={busy} busyLabel="Adding…">
                Add subtask
              </Button>
            )}
          </div>
          {error && <Message tone="error">{error}</Message>}
        </form>
      )}
    </div>
  );
}

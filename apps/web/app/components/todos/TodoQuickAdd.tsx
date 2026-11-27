import type { FormEvent, KeyboardEvent } from "react";
import type { LocalTodo, TodoLink } from "~/lib/todos/todos.sync";

import { canHaveSubtask, isTodoWriter } from "@caretook/data/schema";
import { ListPlus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button, Field, IconButton, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { createTodo } from "~/lib/todos/todos.sync";

/** What the quick add needs of the todo it adds under. */
export type QuickAddParent = Pick<LocalTodo, "id" | "title" | "deletedAt" | "repeatRule">;

/** What a quick-added todo links to: a provider, a medication, or a note or event (`entryId`). */
export type QuickAddLink = TodoLink | { entryId: string };

/** Whether this person may add a todo here: a writer (`isTodoWriter`). */
export const mayAddTodo = (role: string | null | undefined) => isTodoWriter(role);

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
 * The one way to add a todo inline (todo-subtasks-3, todo-links-6): a title
 * field over `createTodo`, under `parent` (a subtask), with `link` (a
 * provider's, medication's, note's or event's page), or both (a linked
 * subtask, so it shows on the page). Enter adds and keeps the field focused
 * and open for the next; a failed write says so inline. `compact` (a list
 * row, a tree; it needs a parent) is an icon-only "Add subtask to <title>"
 * button that opens the field in place, and Escape closes it; `full` (a
 * page's band) shows the field with its Add button. Nothing for a
 * non-writer or a parent that can't take a subtask.
 */
export function TodoQuickAdd({
  parent,
  ancestors = [],
  link,
  form,
  className = "",
}: (
  | { form: "compact"; parent: QuickAddParent }
  | { form: "full"; /** Without one, a top-level todo. */ parent?: QuickAddParent }
) & {
  /** The parent's own chain (its parent, …, up to the top). */
  ancestors?: readonly unknown[];
  /** What the new todo links to. */
  link?: QuickAddLink;
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
  if (parent ? !mayAddSubtask(group.role, ancestors, parent) : !mayAddTodo(group.role)) return null;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    setError(null);
    void createTodo(getSync(), group.id, { title, parentId: parent?.id, ...link })
      .then((result) => (result.ok ? setValue("") : setError(result.error)))
      .catch((err: unknown) => {
        console.error(parent ? "Couldn't add the subtask" : "Couldn't add the todo", err);
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
  const noun = parent ? "subtask" : "todo";
  return (
    <div className={`space-y-2 ${className}`} data-todo-quick-add={form}>
      {compact && (
        // Its own gap from the row's other controls (`ml-1`), so a tap lands on it.
        <IconButton
          ref={opener}
          icon={ListPlus}
          label={`Add subtask to ${parent?.title ?? ""}`}
          expanded={open}
          controls={formId}
          className="ml-1"
          onPress={() => (open ? close() : setOpen(true))}
        />
      )}
      {open && (
        <form id={formId} className="space-y-2" onSubmit={submit} data-subtask-add="">
          <div className="flex items-end gap-2">
            <Field label={`New ${noun}`} labelHidden kind="input" className="min-w-0 flex-1">
              {(control) => (
                <input
                  {...control}
                  type="text"
                  placeholder={`Add a ${noun}`}
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
                Add {noun}
              </Button>
            )}
          </div>
          {error && <Message tone="error">{error}</Message>}
        </form>
      )}
    </div>
  );
}

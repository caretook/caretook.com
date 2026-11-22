import { Check, RotateCcw } from "lucide-react";
import { TodoUndoStatus } from "~/components/todos";
import { Section } from "~/components/ui";

/**
 * The complete or reopen button, for whoever may complete the todo
 * (`canCompleteTodo`: writers, or a viewer it's assigned to), with the
 * shared Undo status after a tick and the write's error.
 */
export function TodoCompletion({
  groupId,
  title,
  done,
  busy,
  error,
  onComplete,
  onReopen,
}: {
  groupId: string;
  title: string;
  done: boolean;
  busy: boolean;
  error: string | null;
  onComplete: () => void;
  onReopen: () => void;
}) {
  return (
    <Section title="Status" id="completion">
      {done ? (
        <button
          type="button"
          className="btn btn-outline btn-sm gap-1"
          disabled={busy}
          aria-label={`Reopen “${title}”`}
          onClick={onReopen}
          data-todo-reopen
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reopen
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm gap-1"
          disabled={busy}
          aria-label={`Mark “${title}” done`}
          onClick={onComplete}
          data-todo-complete
        >
          <Check className="size-4" aria-hidden="true" />
          Mark done
        </button>
      )}
      <TodoUndoStatus groupId={groupId} />
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </Section>
  );
}

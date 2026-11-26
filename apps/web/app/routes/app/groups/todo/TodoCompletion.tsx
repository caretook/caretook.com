import type { TodoTickProgress } from "~/components/todos";

import { Check, RotateCcw } from "lucide-react";
import { useId } from "react";
import { TodoUndoStatus, waitsOnSubtasks } from "~/components/todos";
import { Button, Message, Section } from "~/components/ui";

/**
 * The complete or reopen button, for whoever may complete the todo
 * (`canCompleteTodo`: writers, or a viewer it's assigned to), with the
 * shared Undo status after its own tick (a subtask's shows in Subtasks)
 * and the write's error. With open subtasks (todo-subtasks), Mark done is
 * disabled and reads "n of m": the last subtask's tick completes it.
 */
export function TodoCompletion({
  groupId,
  todoId,
  title,
  done,
  busy,
  error,
  progress,
  onComplete,
  onReopen,
}: {
  groupId: string;
  todoId: string;
  title: string;
  done: boolean;
  busy: boolean;
  error: string | null;
  /** Its subtasks' progress, when it has any. */
  progress?: TodoTickProgress;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const waiting = waitsOnSubtasks(done, progress);
  const waitsId = useId();
  return (
    <Section title="Status" id="completion">
      {done ? (
        <Button
          size="sm"
          icon={RotateCcw}
          disabled={busy}
          aria-label={`Reopen “${title}”`}
          onClick={onReopen}
          data-todo-reopen=""
        >
          Reopen
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={Check}
          disabled={busy || waiting}
          aria-label={`Mark “${title}” done`}
          aria-describedby={waiting ? waitsId : undefined}
          onClick={onComplete}
          data-todo-complete=""
        >
          Mark done
        </Button>
      )}
      {waiting && (
        <p id={waitsId} className="text-muted text-sm" data-completion-progress="">
          {progress?.done} of {progress?.total} subtasks done. It's done when they are.
        </p>
      )}
      <TodoUndoStatus groupId={groupId} todoIds={[todoId]} />
      {error && <Message tone="error">{error}</Message>}
    </Section>
  );
}

import { Check, RotateCcw } from "lucide-react";
import { TodoUndoStatus } from "~/components/todos";
import { Button, Message, Section } from "~/components/ui";

/**
 * The complete or reopen button, for whoever may complete the todo
 * (`canCompleteTodo`: writers, or a viewer it's assigned to), with the
 * shared Undo status after its own tick (a subtask's shows in Subtasks)
 * and the write's error.
 */
export function TodoCompletion({
  groupId,
  todoId,
  title,
  done,
  busy,
  error,
  onComplete,
  onReopen,
}: {
  groupId: string;
  todoId: string;
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
          disabled={busy}
          aria-label={`Mark “${title}” done`}
          onClick={onComplete}
          data-todo-complete=""
        >
          Mark done
        </Button>
      )}
      <TodoUndoStatus groupId={groupId} todoIds={[todoId]} />
      {error && <Message tone="error">{error}</Message>}
    </Section>
  );
}

import { Check, RotateCcw } from "lucide-react";
import { TaskUndoStatus } from "~/components/tasks";

/**
 * The complete or reopen button, for whoever may complete the task
 * (`canCompleteTask`: writers, or a viewer it's assigned to), with the
 * shared Undo status after a tick and the write's error.
 */
export function TaskCompletion({
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
    <div className="space-y-2">
      {done ? (
        <button
          type="button"
          className="btn btn-outline btn-sm gap-1"
          disabled={busy}
          aria-label={`Reopen “${title}”`}
          onClick={onReopen}
          data-task-reopen
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
          data-task-complete
        >
          <Check className="size-4" aria-hidden="true" />
          Mark done
        </button>
      )}
      <TaskUndoStatus groupId={groupId} />
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

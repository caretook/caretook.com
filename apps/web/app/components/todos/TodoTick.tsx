/** A parent's subtask progress (`subtaskProgress`, `progressByParent`): live subtasks, and how many are done. */
export type TodoTickProgress = { done: number; total: number };

/** Whether a tick waits on its subtasks: an open todo with an open live subtask can't be ticked by hand. */
export const waitsOnSubtasks = (done: boolean, progress: TodoTickProgress | undefined) =>
  !done && !!progress && progress.done < progress.total;

/**
 * A todo's tick box: checked when done. Only rendered for someone who may
 * complete the todo (`canCompleteTodo`), so viewers see it on their own
 * todos only. A big hit area for phones. Given a parent's `progress`
 * (todo-subtasks), an open one with open subtasks is disabled and reads
 * "n of m": its last subtask's tick completes it (the rollup).
 */
export function TodoTick({
  title,
  done,
  disabled,
  onChange,
  progress,
  showCount = true,
  large = false,
}: {
  title: string;
  done: boolean;
  disabled?: boolean;
  onChange: (done: boolean) => void;
  /** Its subtasks' progress, when it has any. */
  progress?: TodoTickProgress;
  /** Whether a waiting tick shows "n of m" beside it (a list row says it in its own mark). */
  showCount?: boolean;
  /** Easy mode's size: a much bigger box and hit area. */
  large?: boolean;
}) {
  const waiting = waitsOnSubtasks(done, progress);
  return (
    <label
      className={`flex shrink-0 items-center gap-1.5 ${waiting ? "" : "cursor-pointer"} ${large ? "-m-3 p-3" : "-m-2 p-2"}`}
    >
      <input
        type="checkbox"
        className={`checkbox checkbox-primary ${large ? "checkbox-xl" : ""}`}
        checked={done}
        disabled={disabled || waiting}
        aria-label={
          done
            ? `Reopen “${title}”`
            : waiting
              ? `“${title}”: ${progress?.done} of ${progress?.total} subtasks done`
              : `Mark “${title}” done`
        }
        onChange={(e) => onChange(e.currentTarget.checked)}
        data-todo-tick
      />
      {waiting && showCount && (
        <span
          className="text-muted text-xs whitespace-nowrap tabular-nums"
          aria-hidden="true"
          data-tick-progress
        >
          {progress?.done} of {progress?.total}
        </span>
      )}
    </label>
  );
}

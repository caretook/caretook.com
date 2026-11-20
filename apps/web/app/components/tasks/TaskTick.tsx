/**
 * A task's tick box: checked when done. Only rendered for someone who may
 * complete the task (`canCompleteTask`), so viewers see it on their own
 * tasks only. A big hit area for phones.
 */
export function TaskTick({
  title,
  done,
  disabled,
  onChange,
}: {
  title: string;
  done: boolean;
  disabled?: boolean;
  onChange: (done: boolean) => void;
}) {
  return (
    <label className="-m-2 flex shrink-0 cursor-pointer items-center p-2">
      <input
        type="checkbox"
        className="checkbox checkbox-primary"
        checked={done}
        disabled={disabled}
        aria-label={done ? `Reopen “${title}”` : `Mark “${title}” done`}
        onChange={(e) => onChange(e.currentTarget.checked)}
        data-task-tick
      />
    </label>
  );
}

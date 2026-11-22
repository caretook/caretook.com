/**
 * A todo's tick box: checked when done. Only rendered for someone who may
 * complete the todo (`canCompleteTodo`), so viewers see it on their own
 * todos only. A big hit area for phones.
 */
export function TodoTick({
  title,
  done,
  disabled,
  onChange,
  large = false,
}: {
  title: string;
  done: boolean;
  disabled?: boolean;
  onChange: (done: boolean) => void;
  /** Simple mode's size: a much bigger box and hit area. */
  large?: boolean;
}) {
  return (
    <label className={`flex shrink-0 cursor-pointer items-center ${large ? "-m-3 p-3" : "-m-2 p-2"}`}>
      <input
        type="checkbox"
        className={`checkbox checkbox-primary ${large ? "checkbox-xl" : ""}`}
        checked={done}
        disabled={disabled}
        aria-label={done ? `Reopen “${title}”` : `Mark “${title}” done`}
        onChange={(e) => onChange(e.currentTarget.checked)}
        data-todo-tick
      />
    </label>
  );
}

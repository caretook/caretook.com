import { Repeat } from "lucide-react";

/**
 * The mark on a repeating todo (planner-2), beside its due line in rows and
 * cards: a lucide `Repeat`, named "Repeats" for screen readers, as the
 * appointments' `RepeatMark`. Nothing for a todo that doesn't repeat.
 */
export function TodoRepeatMark({
  todo,
  className = "",
}: {
  todo: { repeatRule: string | null };
  className?: string;
}) {
  if (!todo.repeatRule) return null;
  return (
    <span
      className={`inline-flex items-center align-[-0.125em] ${className}`}
      title="Repeats"
      data-repeat-mark
    >
      <Repeat className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Repeats</span>
    </span>
  );
}

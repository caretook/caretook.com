import { ListTodo } from "lucide-react";
import { openTodosMark } from "~/lib/todos/entryTodoDisplay";

/**
 * A note's or event's open todos on the timeline (planner-3): "1 todo",
 * "2 todos", as text a screen reader reads, with a quiet icon. Nothing at 0.
 */
export function OpenTodosMark({ count }: { count: number | undefined }) {
  const text = openTodosMark(count);
  if (!text) return null;
  return (
    <p className="text-muted inline-flex items-center gap-1 text-xs" data-open-todos={count}>
      <ListTodo className="size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}

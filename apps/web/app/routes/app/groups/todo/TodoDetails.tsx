import type { LocalTodo } from "~/lib/todos/todos.sync";

import { todoState } from "@caretook/data/schema";
import { Repeat } from "lucide-react";
import { Section } from "~/components/ui";
import { todoRepeatLine } from "~/lib/todos/todoDisplay";
import { assigneeText, doneByLine, dueLines } from "./todoPage";

/**
 * Who the todo is for, when it's due (with the overdue or due line while
 * open, and the zone note when the device is elsewhere), how it repeats
 * ("Repeats weekly on Monday"), and who finished it.
 */
export function TodoDetails({
  todo,
  nameOf,
  now,
  timeZone,
  zoneNote,
}: {
  todo: LocalTodo;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  zoneNote: string | null;
}) {
  const due = dueLines(todo, now, timeZone);
  const doneBy = doneByLine(todo, nameOf, now, timeZone);
  const overdue = todoState(todo, now, timeZone) === "overdue";
  const repeats = todoRepeatLine(todo);
  return (
    <Section title="Details" id="details">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Assigned to</dt>
        <dd data-todo-assignee>{assigneeText(todo, nameOf)}</dd>
        <dt className="text-muted">Due</dt>
        <dd data-todo-due>
          <span>{due.day}</span>
          {due.status && (
            <span className={`block ${overdue ? "text-error" : "text-muted"}`}>{due.status}</span>
          )}
          {todo.dueTime && zoneNote && <span className="text-muted block">{zoneNote}</span>}
        </dd>
      </dl>
      {repeats && (
        <p className="text-muted flex items-center gap-1.5 text-sm" data-todo-repeat>
          <Repeat className="size-4 shrink-0" aria-hidden="true" />
          <span>{repeats}</span>
        </p>
      )}
      {doneBy && (
        <p className="text-success text-sm font-medium" data-todo-done-by>
          {doneBy}
        </p>
      )}
    </Section>
  );
}

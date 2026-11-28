import type { NamedTag } from "./loadSearch";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { CircleCheck, ListTodo } from "lucide-react";
import { Link } from "react-router";
import { Badge, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet, dueText } from "@caretook/data/domain";
import { STRETCHED, ROW, Marked, NotesSnippet, NamedTags } from "./resultParts";

/**
 * A todo as a result: its title and its due line, or a "Done" marker for a
 * done one. It opens the todo's page. Matches are marked, and a match only
 * in its notes shows a line from them.
 */
export function TodoResultItem({
  todo,
  notes,
  now,
  timeZone,
  search,
  namedTags,
}: {
  todo: LocalTodo;
  namedTags?: readonly NamedTag[];
  notes?: string;
  now: Date;
  /** The recipient's zone: due days and times are theirs. */
  timeZone: string;
  search: ParsedSearch;
}) {
  const done = !!todo.doneAt;
  const due = dueText(todo, now, timeZone);
  const snippet = notesSnippet([todo.title], notes, search);
  const Icon = done ? CircleCheck : ListTodo;
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="todo"
      data-result-id={todo.id}
      data-done={done ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? "bg-base-200 text-faint" : "bg-primary/15 text-primary"}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.todo(todo.groupId, todo.id)}
            className={`font-medium wrap-break-word ${STRETCHED} ${done ? "text-muted" : ""}`}
          >
            <Marked text={todo.title} search={search} />
          </Link>
          {done && (
            <Badge tone={STATUS_TONE.done} className="shrink-0" data-marker="">
              Done
            </Badge>
          )}
        </p>
        {due && <p className="text-muted text-sm">{due}</p>}
        <NotesSnippet snippet={snippet} />
        <NamedTags tags={namedTags} />
      </div>
    </li>
  );
}

import type { NamedTag } from "./loadSearch";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { CircleCheck, ListTodo } from "lucide-react";
import { Link } from "react-router";
import { Badge, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet, dueText } from "@caretook/data/domain";
import { QuickTags } from "~/components/tags";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { STRETCHED, ROW, Marked, NotesSnippet } from "./resultParts";

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
  tags,
  tagsReadOnly,
}: {
  todo: LocalTodo;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** A member's name and picture by user id (the group's members, read once by the list; slice 5's rows use them). */
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
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
        <QuickTags
          target="todo"
          recordId={todo.id}
          label={todo.title}
          createdBy={todo.createdBy}
          max={ROW_CHIPS}
          tags={tags}
          readOnly={tagsReadOnly}
          className="mt-1"
        />
      </div>
    </li>
  );
}

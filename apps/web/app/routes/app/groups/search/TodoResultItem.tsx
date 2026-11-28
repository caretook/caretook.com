import type { NamedTag } from "./loadSearch";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { ParsedSearch } from "@caretook/data/domain";

import { TodoRow } from "~/components/todos";
import { notesSnippet } from "@caretook/data/domain";
import { NotesSnippet } from "./resultParts";

/**
 * A todo as a result: the Todos page's row (`TodoRow`, `list`, no tick):
 * its title (matches marked) opening its page, the due or done line, the
 * repeat mark, the assignee chip and its tags, and, when the match is only
 * in its notes, a line from them under the due line.
 */
export function TodoResultItem({
  todo,
  notes,
  now,
  timeZone,
  search,
  tags,
  tagsReadOnly,
  nameOf,
}: {
  todo: LocalTodo;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** A member's name by user id (the group's members, read once by the list): the assignee chip. */
  nameOf: (userId: string) => string;
  notes?: string;
  now: Date;
  /** The recipient's zone: due days and times are theirs. */
  timeZone: string;
  search: ParsedSearch;
}) {
  const snippet = notesSnippet([todo.title], notes, search);
  return (
    <TodoRow
      todo={todo}
      nameOf={nameOf}
      now={now.getTime()}
      timeZone={timeZone}
      busy={false}
      tagsOf={() => tags}
      tagsReadOnly={tagsReadOnly}
      search={search}
      footer={<NotesSnippet snippet={snippet} />}
      data-result="todo"
      data-result-id={todo.id}
      data-done={todo.doneAt ? "" : undefined}
    />
  );
}

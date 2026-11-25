import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { LinkableEntryRow } from "~/lib/todos/entryTodos.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { LinkableEntry } from "~/lib/todos/entryTodoDisplay";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { useCallback, useMemo, useState } from "react";
import { toPreviews } from "~/lib/live-notes/notes.sync";
import { getSync, useLiveQuery } from "~/lib/sync";
import {
  linkableEntriesQuery,
  linkTodo,
  todoEntriesQuery,
  todoEntryDocumentsQuery,
  unlinkTodo,
} from "~/lib/todos/entryTodos.sync";
import { fromLocalTimestamp, toTimelineEntries } from "~/lib/timeline/timeline.sync";

export type LinkedEntry = ReturnType<typeof toTimelineEntries>[number];

/**
 * A todo's linked notes and events (planner-3), live, newest first: one
 * query for the entries and one for their documents' text (the notes' first
 * lines), never one per row. A deleted entry drops out; other kinds aren't
 * shown. `text` is an entry's document text ("" without one).
 */
export function useTodoEntries(
  groupId: string,
  todoId: string,
  loaded: { entries: EntryRow[]; documents: NoteDocRow[] },
) {
  const eq = todoEntriesQuery(todoId);
  const entryRows = useLiveQuery<EntryRow>(eq.sql, eq.params, loaded.entries);
  const dq = todoEntryDocumentsQuery(todoId);
  const documentRows = useLiveQuery<NoteDocRow>(dq.sql, dq.params, loaded.documents);
  const entries = useMemo(
    () => toTimelineEntries(entryRows).filter((e) => e.groupId === groupId && canHaveNoteDocument(e.kind)),
    [entryRows, groupId],
  );
  const texts = useMemo(() => toPreviews(documentRows), [documentRows]);
  const textOf = useCallback((id: string) => texts.get(id) ?? "", [texts]);
  return { entries, textOf };
}

/** Link or remove an entry (writers; local writes that upload), with the last refusal's message. */
export function useEntryLinking(todoId: string) {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (write: Promise<{ ok: boolean; error?: string }>) => {
    const result = await write;
    setError(result.ok ? null : (result.error ?? "That didn't save. Try again."));
    return result.ok;
  }, []);
  const link = useCallback((entryId: string) => run(linkTodo(getSync(), entryId, todoId)), [run, todoId]);
  const unlink = useCallback((entryId: string) => run(unlinkTodo(getSync(), entryId, todoId)), [run, todoId]);
  return { link, unlink, error };
}

const NO_ROWS: LinkableEntryRow[] = [];

/** "Link an entry"'s candidates: the group's live notes and events this todo doesn't link yet, newest first. */
export function useLinkableEntries(groupId: string, todoId: string): LinkableEntry[] {
  const q = linkableEntriesQuery(groupId, todoId);
  const rows = useLiveQuery<LinkableEntryRow>(q.sql, q.params, NO_ROWS);
  return useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        occurredAt: fromLocalTimestamp(r.occurred_at),
        text: r.text,
      })),
    [rows],
  );
}

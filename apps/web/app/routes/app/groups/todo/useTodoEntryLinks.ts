import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { useCallback, useMemo, useState } from "react";
import { toPreviews } from "~/lib/live-notes/notes.sync";
import { getSync, useLiveQuery } from "~/lib/sync";
import { linkTodo, todoEntriesQuery, todoEntryDocumentsQuery, unlinkTodo } from "~/lib/todos/entryTodos.sync";
import { updateTodo } from "~/lib/todos/todos.sync";
import { toTimelineEntries } from "~/lib/timeline/timeline.sync";

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

/**
 * Link or remove an entry, and set or clear the provider or medication slot
 * (writers; local writes that upload; a new provider or medication replaces
 * the one there), with the last refusal's message.
 */
export function useEntryLinking(todoId: string) {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (write: Promise<{ ok: boolean; error?: string }>) => {
    const result = await write;
    setError(result.ok ? null : (result.error ?? "That didn't save. Try again."));
    return result.ok;
  }, []);
  const link = useCallback((entryId: string) => run(linkTodo(getSync(), entryId, todoId)), [run, todoId]);
  const unlink = useCallback((entryId: string) => run(unlinkTodo(getSync(), entryId, todoId)), [run, todoId]);
  const setSlot = useCallback(
    (slot: "providerId" | "medicationId", id: string | null) =>
      run(updateTodo(getSync(), todoId, { [slot]: id })),
    [run, todoId],
  );
  return { link, unlink, setSlot, error };
}

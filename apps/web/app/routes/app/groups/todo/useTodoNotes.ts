import type * as Y from "yjs";

import { useCallback, useRef, useState } from "react";
import { shouldMaterialize } from "~/lib/live-notes/liveEntry";
import { getSync } from "~/lib/sync";
import { createTodoDocument } from "~/lib/todos/todos.sync";
import { noteText } from "@caretook/data/domain";

/**
 * The todo's notes document, made on the first real change (text), like a
 * medication's: `ensureSaved` for `LiveNotesEditor`, and the error when
 * making it failed.
 */
export function useTodoNotes(todoId: string, hasDocument: boolean) {
  const saved = useRef(hasDocument);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ensureSaved = useCallback(
    async (doc: Y.Doc) => {
      if (saved.current) return true;
      if (!shouldMaterialize({ saved: false, text: noteText(doc), title: "" })) return false;
      const res = await createTodoDocument(getSync(), todoId);
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      return true;
    },
    [todoId],
  );
  return { ensureSaved, saveError };
}

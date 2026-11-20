import type * as Y from "yjs";

import { noteText } from "@caretook/data/schema";
import { useCallback, useRef, useState } from "react";
import { shouldMaterialize } from "~/lib/liveEntry";
import { getSync } from "~/lib/sync";
import { createProviderDocument } from "~/lib/sync/providers";

/**
 * The provider's notes document, made on the first real change (text), like
 * a draft entry's: `ensureSaved` for `LiveNotesEditor`, and the error when
 * making it failed.
 */
export function useProviderNotes(providerId: string, hasDocument: boolean) {
  const saved = useRef(hasDocument);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ensureSaved = useCallback(
    async (doc: Y.Doc) => {
      if (saved.current) return true;
      if (!shouldMaterialize({ saved: false, text: noteText(doc), title: "" })) return false;
      const res = await createProviderDocument(getSync(), providerId);
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      return true;
    },
    [providerId],
  );
  return { ensureSaved, saveError };
}

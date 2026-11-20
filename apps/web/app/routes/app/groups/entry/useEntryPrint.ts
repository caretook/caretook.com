import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { NoteDocParts, NoteDocRow } from "~/lib/live-notes/notes.sync";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PRINT_PARAM } from "~/lib/live-notes/urls";
import { useLiveQuery } from "~/lib/sync";
import { documentPreviewQuery, previewText } from "~/lib/live-notes/notes.sync";
import { entryProvidersQuery, toProviders } from "~/lib/providers/providers.sync";

const NO_PROVIDERS: ProviderRow[] = [];

/**
 * What the entry's print view shows, live: its linked providers, and its
 * text (pending edits included). `initial` is the loader's document, so the
 * text is there on the first render (a print asked for on open needs it).
 */
export function useEntryPrint(entryId: string, initial: NoteDocParts) {
  const providerQuery = entryProvidersQuery(entryId);
  const providerRows = useLiveQuery<ProviderRow>(providerQuery.sql, providerQuery.params, NO_PROVIDERS);
  const providers = useMemo(() => toProviders(providerRows), [providerRows]);

  const [initialRows] = useState<NoteDocRow[]>(() => [
    {
      id: entryId,
      snapshot: initial.snapshot,
      text: null,
      updates: JSON.stringify(initial.updates.map((u) => u.data)),
    },
  ]);
  const docQuery = documentPreviewQuery(entryId);
  const docRows = useLiveQuery<NoteDocRow>(docQuery.sql, docQuery.params, initialRows);
  const text = useMemo(() => (docRows[0] ? previewText(docRows[0]) : ""), [docRows]);

  return { providers, text };
}

/**
 * Prints once when the page was opened to print (`?print=1`, the ⋯ menu's
 * Print on a row), then drops the parameter so Back or a reload doesn't
 * print again.
 */
export function usePrintOnOpen() {
  const location = useLocation();
  const navigate = useNavigate();
  const asked = new URLSearchParams(location.search).has(PRINT_PARAM);
  const done = useRef(false);
  useEffect(() => {
    if (!asked || done.current) return;
    // After the page has laid out its print view.
    const timer = setTimeout(() => {
      done.current = true;
      window.print();
      const search = new URLSearchParams(location.search);
      search.delete(PRINT_PARAM);
      const rest = search.toString();
      void navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "" }, { replace: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [asked, location.pathname, location.search, navigate]);
}

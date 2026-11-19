import type { LinkUse } from "../providerSuggestions";
import type { NoteDocRow } from "./notes";
import type { LinkHistoryRow, LocalProvider, ProviderRow } from "./providers";

import { useMemo } from "react";
import { suggestProviders } from "../providerSuggestions";
import { useLiveQuery } from "./index";
import { previewText } from "./notes";
import { linkHistoryQuery, providersQuery, toProviders } from "./providers";
import { fromLocalTimestamp } from "./timeline";

// Provider suggestions for one note or event, read from the local database
// (so they work offline) and ranked by the pure `suggestProviders`.

/** One document with its pending updates, so the text includes edits not compacted (or uploaded) yet. */
const documentSql = `SELECT d.id, d.snapshot, d.text,
         (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
  FROM note_document d WHERE d.id = ?`;

const NO_PROVIDERS: ProviderRow[] = [];
const NO_LINKS: LinkHistoryRow[] = [];
const NO_DOCS: NoteDocRow[] = [];

const toUse = (row: LinkHistoryRow): LinkUse => ({
  providerId: row.provider_id,
  entryId: row.entry_id,
  title: row.title,
  linkedAt: row.linked_at ? fromLocalTimestamp(row.linked_at) : null,
});

/** Up to 5 providers to suggest for an entry with this title, live (its text and the group's links). */
export function useProviderSuggestions({
  groupId,
  entryId,
  title,
}: {
  groupId: string;
  entryId: string;
  title: string | null;
}): LocalProvider[] {
  const providers = providersQuery(groupId);
  const providerRows = useLiveQuery<ProviderRow>(providers.sql, providers.params, NO_PROVIDERS);
  const history = linkHistoryQuery(groupId);
  const historyRows = useLiveQuery<LinkHistoryRow>(history.sql, history.params, NO_LINKS);
  const docRows = useLiveQuery<NoteDocRow>(documentSql, [entryId], NO_DOCS);

  const all = useMemo(() => toProviders(providerRows), [providerRows]);
  const uses = useMemo(() => historyRows.map(toUse), [historyRows]);
  const text = useMemo(() => (docRows[0] ? previewText(docRows[0]) : ""), [docRows]);

  return useMemo(
    () => suggestProviders({ title, text, providers: all, history: uses, entryId }),
    [title, text, all, uses, entryId],
  );
}

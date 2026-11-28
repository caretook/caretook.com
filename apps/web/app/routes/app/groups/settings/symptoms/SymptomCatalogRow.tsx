import type { ActionResult } from "~/lib/core/api";
import type { SymptomCatalogRow as Row } from "~/lib/timeline/symptomCatalogPage.sync";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { IconButton, ListRow, Message } from "~/components/ui";
import { DeleteSymptomDialog } from "./DeleteSymptomDialog";

/** "3 entries", "1 entry", "0 entries". */
export const entryCount = (n: number) => (n === 1 ? "1 entry" : `${n} entries`);

/** What a row is called: its name, or "Symptom" for a row synced without one. */
const symptomName = (row: Row) => row.name?.trim() || "Symptom";

/**
 * One symptom on the Symptoms page, laid out like a Tags page row: its name
 * and how many live entries use it. A writer (`canArchive`) gets Archive on
 * an active row and Unarchive on an archived one, through the page's
 * `clientAction` (online only: offline it says it needs a connection). The
 * row moves sections when the change syncs back. An owner (`canDelete`) also
 * gets Delete, when another active symptom can take its place (`others`):
 * `DeleteSymptomDialog`, and the row leaves once its tombstone syncs back.
 * Anyone else sees the row only.
 */
export function SymptomCatalogRow({
  row,
  canArchive,
  canDelete = false,
  others = [],
}: {
  row: Row;
  canArchive: boolean;
  canDelete?: boolean;
  /** The group's other active symptoms, A to Z: what Delete offers in its place. */
  others?: readonly Row[];
}) {
  const [deleting, setDeleting] = useState(false);
  const deletable = canDelete && others.length > 0;
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const name = symptomName(row);
  const archived = !!row.archived_at;
  const submit = () =>
    void fetcher.submit({ intent: archived ? "unarchive" : "archive", id: row.id }, { method: "post" });

  return (
    <ListRow className="space-y-2" data-symptom-row={row.id}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="truncate font-medium" data-symptom-name="">
            {name}
          </span>
          <span className="text-muted text-sm" data-symptom-entries="">
            {entryCount(row.entries)}
          </span>
        </div>
        {(canArchive || deletable) && (
          <div className="flex shrink-0 items-center gap-2">
            {!canArchive ? null : archived ? (
              <IconButton
                label={`Unarchive ${name}`}
                icon={ArchiveRestore}
                disabled={busy}
                onPress={submit}
                data-symptom-unarchive={row.id}
              />
            ) : (
              <IconButton
                label={`Archive ${name}`}
                icon={Archive}
                disabled={busy}
                onPress={submit}
                data-symptom-archive={row.id}
              />
            )}
            {deletable && (
              <IconButton
                label={`Delete ${name}`}
                icon={Trash2}
                onPress={() => setDeleting(true)}
                data-symptom-delete={row.id}
              />
            )}
          </div>
        )}
      </div>
      {result && !result.ok && <Message tone="error">{result.error}</Message>}
      {deletable && (
        <DeleteSymptomDialog
          symptom={{ id: row.id, name, entries: row.entries ? entryCount(row.entries) : null }}
          others={others.map((r) => ({ id: r.id, name: symptomName(r) }))}
          open={deleting}
          onClose={() => setDeleting(false)}
        />
      )}
    </ListRow>
  );
}

import type { SyncDb } from "~/lib/sync";
import type { EntryFilters } from "./timeline.sync";
import type { NewerWindow } from "./timelineNewer";

import { PAGE_SIZE } from "~/lib/core/paging";
import { rowPassLogId } from "~/lib/medications/passLogs";
import { fromLocalTimestamp, newerEdgeQuery, readRows } from "./timeline.sync";
import { nextNewerWindow } from "./timelineNewer";

type EdgeRow = { occurred_at: string; kind: string | null; details: string | null };

/**
 * Where a jump's window moves next: reads the rows above `before`, a little
 * more each time until the whole day and any pass log at the edge are in.
 */
export const readNewerWindow = async (
  db: SyncDb,
  groupId: string,
  filters: EntryFilters,
  before: string,
  cutoff: string,
  timeZone: string,
): Promise<NewerWindow> => {
  for (let asked = 3 * PAGE_SIZE; ; asked *= 2) {
    const rows = await readRows<EdgeRow>(db, newerEdgeQuery(groupId, filters, before, cutoff, asked));
    const next = nextNewerWindow(
      rows.map((row) => ({ at: fromLocalTimestamp(row.occurred_at), log: rowPassLogId(row) })),
      { asked, timeZone },
    );
    if (next) return next;
  }
};

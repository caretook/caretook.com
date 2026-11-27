import type { LocalQuery } from "./timeline.sync";

import { useLiveQuery } from "../sync/index";

// The Symptoms page in group settings (symptom-catalog-2): the group's
// catalog from the device's copy, active and archived rows A to Z, each with
// how many live entries use it (one query for the page). A merged row (a
// tombstone, `replaced_by_id`) is never listed. Archiving is server-set
// (oRPC), so nothing here writes.

export type SymptomCatalogRow = {
  id: string;
  name: string | null;
  archived_at: string | null;
  entries: number;
};

/** The group's catalog rows, tombstones left out, A to Z by key, each with its live-entry count. */
export const symptomCatalogPageQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT s.id, s.name, s.archived_at,
          (SELECT count(*) FROM timeline_entry e
            WHERE e.group_id = s.group_id AND e.symptom_type_id = s.id AND e.deleted_at IS NULL) AS entries
        FROM symptom_type s
        WHERE s.group_id = ? AND s.replaced_by_id IS NULL
        ORDER BY s.name_key, s.id`,
  params: [groupId],
});

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: SymptomCatalogRow[] = [];

/** The catalog rows, live (so an archive arriving by sync moves its row), from `initial` (the loader's read). */
export function useSymptomCatalogPage(groupId: string, initial: SymptomCatalogRow[] = NO_ROWS) {
  const q = symptomCatalogPageQuery(groupId);
  return useLiveQuery<SymptomCatalogRow>(q.sql, q.params, initial);
}

/** The active rows, then the archived ones, each still A to Z. */
export const splitByArchived = (rows: readonly SymptomCatalogRow[]) => ({
  active: rows.filter((r) => !r.archived_at),
  archived: rows.filter((r) => !!r.archived_at),
});

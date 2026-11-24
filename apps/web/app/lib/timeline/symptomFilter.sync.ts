import type { LocalQuery } from "./timeline.sync";

import { useLiveQuery } from "../sync/index";

// The timeline's symptom-type filter (symptom-catalog): which catalog rows the
// Filter sheet offers, read from the local copy so it works offline. A type is
// offered while the group has a live symptom pointing at it (by the stored
// `symptom_type_id`, as the filter itself matches); the sheet keeps a chosen
// one too, by its name here.

export type SymptomFilterRow = { id: string; name: string; used: number };

/** The group's catalog, A to Z by key, each with whether a live symptom points at it (`used`, 1 or 0). */
export const symptomFilterQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT t.id, t.name,
               EXISTS (SELECT 1 FROM timeline_entry e
                        WHERE e.group_id = t.group_id AND e.symptom_type_id = t.id
                          AND e.kind = 'symptom' AND e.deleted_at IS NULL) AS used
          FROM symptom_type t WHERE t.group_id = ? ORDER BY t.name_key, t.id`,
  params: [groupId],
});

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: SymptomFilterRow[] = [];

/** The group's catalog for the filter, live (empty until it has synced). */
export function useSymptomFilterTypes(groupId: string): SymptomFilterRow[] {
  const query = symptomFilterQuery(groupId);
  return useLiveQuery<SymptomFilterRow>(query.sql, query.params, NO_ROWS);
}

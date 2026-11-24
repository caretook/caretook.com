import type { LocalQuery } from "./timeline.sync";

import { useLiveQuery } from "../sync/index";

// The group's symptom catalog on the device (symptom-catalog): the names the
// symptom sheet suggests, read from the local copy, so they work offline.
// Rows arrive by sync (`symptom_type`, every member's); they're added, never
// changed or removed.

export type SymptomTypeRow = { id: string; name: string };

/** The group's catalog, A to Z by key. */
export const symptomTypesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, name FROM symptom_type WHERE group_id = ? ORDER BY name_key, id`,
  params: [groupId],
});

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: SymptomTypeRow[] = [];

/** The group's catalog, live (empty until it has synced). */
export function useSymptomTypes(groupId: string): SymptomTypeRow[] {
  const query = symptomTypesQuery(groupId);
  return useLiveQuery<SymptomTypeRow>(query.sql, query.params, NO_ROWS);
}

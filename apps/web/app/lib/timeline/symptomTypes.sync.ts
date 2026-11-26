import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "./timeline.sync";

import { symptomTypeRow } from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { useLiveQuery } from "../sync/index";
import { symptomTypes } from "../sync/schema";

// The group's symptom catalog on the device (symptom-catalog): the names the
// symptom sheet suggests, read from the local copy, so they work offline.
// Rows arrive by sync (`symptom_type`, every member's), or are added here
// with the entry that first uses a name (one local write; uploaded as a PUT
// the server makes idempotent); never changed or removed.

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

/** What a local write adds a catalog row in: the database, or its transaction. */
type WriteTx = Pick<SyncDb["drizzle"], "select" | "insert">;

/**
 * The group's catalog row for `name`, added to the local copy when it has
 * none, in the caller's write (an entry's create or rename). The id and key
 * are the server's (`symptomTypeRow`), so two devices adding the same name
 * offline upload one row. Returns its id. The caller checks the actor may log.
 */
export const addSymptomTypeIn = async (
  tx: WriteTx,
  { groupId, name, userId, now }: { groupId: string; name: string; userId: string; now: string },
) => {
  const row = symptomTypeRow(groupId, name);
  const [have] = await tx
    .select({ id: symptomTypes.id })
    .from(symptomTypes)
    .where(eq(symptomTypes.id, row.id))
    .limit(1);
  if (!have)
    await tx
      .insert(symptomTypes)
      .values({ ...row, createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId });
  return row.id;
};

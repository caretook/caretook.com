import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "./timeline.sync";

import { symptomTypeRow } from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { useMemo } from "react";
import { useLiveQuery } from "../sync/index";
import { symptomTypes } from "../sync/schema";

// The group's symptom catalog on the device (symptom-catalog): the names the
// symptom sheet suggests, read from the local copy, so they work offline.
// Rows arrive by sync (`symptom_type`, every member's), or are added here
// with the entry that first uses a name (one local write; uploaded as a PUT
// the server makes idempotent). Archiving and merging are the server's
// (symptom-catalog-2): an archived row stays in the catalog, `archived`, so
// typing its name exactly still reuses it, but suggestions leave it out; a
// tombstone (`replaced_by_id`, merged into another row) is never returned.

export type SymptomTypeRow = { id: string; name: string; archived: boolean };

/** The row as SQLite returns it: `archived` is 0 or 1. */
type StoredSymptomTypeRow = { id: string; name: string; archived: number };

/** The group's catalog, active and archived, no tombstones, A to Z by key. */
export const symptomTypesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, name, archived_at IS NOT NULL AS archived FROM symptom_type
    WHERE group_id = ? AND replaced_by_id IS NULL ORDER BY name_key, id`,
  params: [groupId],
});

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: StoredSymptomTypeRow[] = [];

/**
 * The group's catalog, live (empty until it has synced): active and
 * archived rows, each with `archived`. A list of suggestions shows only the
 * active ones; a name check (`similarSymptoms`) takes them all.
 */
export function useSymptomTypes(groupId: string): SymptomTypeRow[] {
  const query = symptomTypesQuery(groupId);
  const rows = useLiveQuery<StoredSymptomTypeRow>(query.sql, query.params, NO_ROWS);
  return useMemo(() => rows.map((row) => ({ ...row, archived: !!row.archived })), [rows]);
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

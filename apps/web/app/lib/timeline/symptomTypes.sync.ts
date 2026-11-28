import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "./timeline.sync";

import { resolveSymptom, symptomTypeRow } from "@caretook/data/schema";
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
// A write naming a tombstone saves as its replacement (symptom-catalog-3:
// `resolveSymptom`, as the server does), so an offline entry shows the
// name it will have once uploaded.

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

/** A catalog row as a write reads it: a tombstone has `replacedById`. */
export type CatalogRow = { id: string; name: string; replacedById: string | null };

/**
 * The catalog row a symptom named `name` saves under, over the group's local
 * `catalog` (pure): the row for its key, or a deleted name's replacement
 * (`resolveSymptom`: its id and its name). A name the group has no row for
 * keeps its spelling and its derived id (the server's, `symptomTypeRow`),
 * with `add` the row to write; otherwise `add` is null. A tombstone whose
 * replacement hasn't synced yet saves as itself (the server resolves it).
 */
export const symptomTypeFor = (groupId: string, name: string, catalog: readonly CatalogRow[]) => {
  const row = symptomTypeRow(groupId, name);
  const resolved = resolveSymptom(name, catalog);
  if (resolved && resolved.id.toLowerCase() !== row.id)
    return { id: resolved.id, name: resolved.name, add: null };
  const have = resolved ?? catalog.find((r) => r.id.toLowerCase() === row.id);
  return { id: row.id, name, add: have ? null : row };
};

/**
 * The catalog row a symptom named `name` saves under (`symptomTypeFor`, over
 * the group's local copy), added to the local copy when the group has none,
 * in the caller's write (an entry's create or rename). Two devices adding
 * the same name offline upload one row. Returns the row's id and the name
 * the entry stores (a deleted name's replacement's). The caller checks the
 * actor may log.
 */
export const addSymptomTypeIn = async (
  tx: WriteTx,
  { groupId, name, userId, now }: { groupId: string; name: string; userId: string; now: string },
): Promise<{ id: string; name: string }> => {
  const rows = await tx
    .select({ id: symptomTypes.id, name: symptomTypes.name, replacedById: symptomTypes.replacedById })
    .from(symptomTypes)
    .where(eq(symptomTypes.groupId, groupId));
  const catalog = rows.map((r) => ({ ...r, name: r.name ?? "" }));
  const symptom = symptomTypeFor(groupId, name, catalog);
  if (symptom.add)
    await tx
      .insert(symptomTypes)
      .values({ ...symptom.add, createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId });
  return { id: symptom.id, name: symptom.name };
};

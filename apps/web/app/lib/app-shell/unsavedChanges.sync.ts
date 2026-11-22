import type { UnsavedRecord } from "./unsavedChanges";
import type { SyncDb } from "~/lib/sync";

// The device side of "Changes not saved": reading and dismissing the
// local-only `unsaved_change` records (the uploader writes them). Dismissing
// deletes them for good: they never sync, and sign-out's wipe clears the rest.

/** Every record, newest first (`unsavedLines` groups them). */
export const UNSAVED_SQL = `SELECT id, recorded_at AS recordedAt, table_name AS tableName, row_id AS rowId,
  op, data, code, issues, outcome, label, line_key AS lineKey
  FROM unsaved_change ORDER BY recorded_at DESC, id`;

export const loadUnsaved = (db: SyncDb) => db.powersync.getAll<UnsavedRecord>(UNSAVED_SQL);

/** Dismiss one line's records. */
export const dismissUnsaved = async (db: SyncDb, ids: readonly string[]) => {
  if (ids.length === 0) return;
  await db.powersync.execute(`DELETE FROM unsaved_change WHERE id IN (SELECT value FROM json_each(?))`, [
    JSON.stringify(ids),
  ]);
};

/** Dismiss everything listed. */
export const dismissAllUnsaved = async (db: SyncDb) => {
  await db.powersync.execute("DELETE FROM unsaved_change");
};

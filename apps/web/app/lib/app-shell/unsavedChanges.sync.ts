import type { UnsavedRecord } from "./unsavedChanges";
import type { SyncDb } from "~/lib/sync";
import type { UploadCall, UploadOp } from "~/lib/sync/uploader";

// The device side of "Changes not saved": reading and dismissing the
// local-only `unsaved_change` records (the uploader writes them). Dismissing
// deletes them for good: they never sync, and sign-out's wipe clears the rest.
// "Try again" sends a set-aside change to the server once more.

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

type SetAside = { id: string; table: string; rowId: string; op: string; data: string | null };

const OPS = ["PUT", "PATCH", "DELETE"] as const;
const isOp = (op: string): op is UploadOp["op"] => (OPS as readonly string[]).includes(op);

const parseData = (data: string | null): Record<string, unknown> | null => {
  if (!data) return null;
  try {
    const value: unknown = JSON.parse(data);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * "Try again" (B-286): send a line's set-aside changes, oldest first, to
 * `sync.upload` directly (they already left the upload queue). Each one the
 * server applies is removed from the list; a refusal stays listed with its
 * new reason (and no Try again), a failure stays set aside. A request that
 * fails as a whole (offline, a 5xx) throws and changes nothing.
 */
export const retryUnsaved = async (db: SyncDb, ids: readonly string[], upload: UploadCall) => {
  const records = await db.powersync.getAll<SetAside>(
    `SELECT id, table_name AS "table", row_id AS rowId, op, data FROM unsaved_change
     WHERE outcome = 'set_aside' AND id IN (SELECT value FROM json_each(?))
     ORDER BY recorded_at, id`,
    [JSON.stringify(ids)],
  );
  const sendable = records.filter((r): r is SetAside & { op: UploadOp["op"] } => isOp(r.op));
  if (sendable.length === 0) return;
  const { results } = await upload({
    ops: sendable.map((r) => ({ op: r.op, table: r.table, id: r.rowId, data: parseData(r.data) })),
  });
  await db.powersync.writeTransaction(async (tx) => {
    for (const [i, record] of sendable.entries()) {
      const result = results[i];
      if (!result || result.id !== record.rowId) break;
      if (result.status === "applied")
        await tx.execute("DELETE FROM unsaved_change WHERE id = ?", [record.id]);
      else
        await tx.execute(
          "UPDATE unsaved_change SET recorded_at = ?, code = ?, issues = ?, outcome = ? WHERE id = ?",
          [
            new Date().toISOString(),
            result.code,
            result.status === "rejected" && result.issues?.length ? JSON.stringify(result.issues) : null,
            result.status === "rejected" ? "refused" : "set_aside",
            record.id,
          ],
        );
    }
  });
};

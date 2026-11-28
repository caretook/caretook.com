import type { UnsavedRecord } from "./unsavedChanges";
import type { SyncDb } from "~/lib/sync";
import type { UploadCall, UploadOp } from "~/lib/sync/uploader";

import { SYNC_WRITE_LIMIT } from "@caretook/data/domain";
import { UPLOAD_BATCH } from "~/lib/sync/uploader";
import { inWriteOrder } from "./unsavedChanges";

// The device side of "Changes not saved": reading and dismissing the
// local-only `unsaved_change` records (the uploader writes them). Dismissing
// deletes them for good: they never sync, and sign-out's wipe clears the rest.
// "Try again" sends a set-aside change to the server once more.

/** Every record, newest first (`unsavedLines` groups them). */
export const UNSAVED_SQL = `SELECT id, recorded_at AS recordedAt, table_name AS tableName, row_id AS rowId,
  op, data, code, issues, outcome, label, line_key AS lineKey, write_id AS writeId, write_seq AS writeSeq
  FROM unsaved_change ORDER BY recorded_at DESC, write_seq DESC, id`;

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

type SetAside = {
  id: string;
  recordedAt: string;
  table: string;
  rowId: string;
  op: UploadOp["op"];
  data: string | null;
  writeId: number | null;
  writeSeq: number | null;
};

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
 * The records as requests, the uploader's way: whole writes (a run sharing a
 * write id; none: its own) up to UPLOAD_BATCH ops, or one write alone up to
 * SYNC_WRITE_LIMIT.
 */
const requestsOf = (records: SetAside[]) => {
  const writes: SetAside[][] = [];
  for (const record of records) {
    const last = writes.at(-1);
    if (last && record.writeId !== null && last[0]!.writeId === record.writeId) last.push(record);
    else writes.push([record]);
  }
  const requests: SetAside[][] = [];
  for (const write of writes) {
    const last = requests.at(-1);
    if (last && last.length + write.length <= UPLOAD_BATCH) last.push(...write);
    else if (write.length <= SYNC_WRITE_LIMIT) requests.push([...write]);
    // Over the limit (the uploader never sets one aside whole): its own writes, a batch at a time.
    else
      for (let i = 0; i < write.length; i += UPLOAD_BATCH)
        requests.push(write.slice(i, i + UPLOAD_BATCH).map((r) => ({ ...r, writeId: null })));
  }
  return requests;
};

const toOp = (r: SetAside): UploadOp => ({
  op: r.op,
  table: r.table,
  id: r.rowId,
  data: parseData(r.data),
  ...(r.writeId === null ? {} : { write: r.writeId }),
});

/**
 * "Try again" (B-286): send a line's set-aside changes, oldest first, to
 * `sync.upload` directly (they already left the upload queue), each with the
 * write it was sent in, so a set-aside write goes whole again (B-294). Each
 * one the server applies is removed from the list; a refusal stays listed
 * with its new reason (and no Try again), a failure stays set aside. A
 * request that fails as a whole (offline, a 5xx) throws and changes nothing
 * it sent.
 */
export const retryUnsaved = async (db: SyncDb, ids: readonly string[], upload: UploadCall) => {
  const records = await db.powersync.getAll<Omit<SetAside, "op"> & { op: string }>(
    `SELECT id, recorded_at AS recordedAt, table_name AS "table", row_id AS rowId, op, data,
       write_id AS writeId, write_seq AS writeSeq
     FROM unsaved_change WHERE outcome = 'set_aside' AND id IN (SELECT value FROM json_each(?))`,
    [JSON.stringify(ids)],
  );
  const sendable = inWriteOrder(records).filter((r): r is SetAside => isOp(r.op));
  for (const request of requestsOf(sendable)) {
    const { results } = await upload({ ops: request.map(toOp) });
    const now = new Date().toISOString();
    await db.powersync.writeTransaction(async (tx) => {
      for (const [i, record] of request.entries()) {
        const result = results[i];
        if (!result || result.id !== record.rowId) break;
        if (result.status === "applied")
          await tx.execute("DELETE FROM unsaved_change WHERE id = ?", [record.id]);
        else
          await tx.execute(
            "UPDATE unsaved_change SET recorded_at = ?, code = ?, issues = ?, outcome = ? WHERE id = ?",
            [
              now,
              result.code,
              result.status === "rejected" && result.issues?.length ? JSON.stringify(result.issues) : null,
              result.status === "rejected" ? "refused" : "set_aside",
              record.id,
            ],
          );
      }
    });
  }
};

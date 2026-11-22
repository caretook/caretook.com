import type { Router } from "@caretook/api";
import type { InferRouterInputs } from "@orpc/server";
import type { AbstractPowerSyncDatabase, CrudEntry } from "@powersync/web";
import type { ApiOutputs } from "../core/rpc";

import { getTableName } from "drizzle-orm";
import { drizzleSchema } from "./schema";

// The device's upload (PowerSync's `uploadData`), apart from the client so a
// device test can drive it with a stubbed server: it takes the database and
// the `sync.upload` call. Each op the server refuses (`rejected`, a 4xx) is
// recorded in the local-only `unsaved_change` table, with its data, the
// server's code and issues, and a label of what the row was, before the batch
// is acknowledged: the next sync then puts the server's copy back, and the
// "Changes not saved" page (Settings) still lists what was lost (B-285).

/** Ops per upload request. Matches SYNC_BATCH_LIMIT in packages/api/src/sync.ts. */
export const UPLOAD_BATCH = 100;

export type UploadInput = InferRouterInputs<Router>["sync"]["upload"];
export type UploadOutput = ApiOutputs["sync"]["upload"];
export type UploadResult = UploadOutput["results"][number];
export type UploadOp = UploadInput["ops"][number];
/** The server call: `rpc.sync.upload`, or a test's stand-in. */
export type UploadCall = (input: UploadInput) => Promise<UploadOutput>;

type Refusal = Extract<UploadResult, { status: "rejected" }>;

/** The op the server gets for one queued entry. */
const toOp = (entry: CrudEntry): UploadOp => ({
  op: entry.op,
  table: entry.table,
  id: entry.id,
  data: entry.opData ?? null,
  ...(entry.metadata ? { metadata: entry.metadata } : {}),
});

/** The device's own tables: the only names a label lookup reads from. */
const DEVICE_TABLES = new Set<string>(Object.values(drizzleSchema).map((table) => getTableName(table)));

/** The columns that name a row, in order of preference. */
const LABEL_COLUMNS = ["title", "name", "substance", "label"] as const;

/** A row's title or name, from an op's data or a local row; null when it has none. */
export const pickLabel = (row: Record<string, unknown> | null | undefined): string | null => {
  for (const column of LABEL_COLUMNS) {
    const value = row?.[column];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

/** The note tables: a document and its updates are one line on the page. */
const NOTE_TABLES = new Set(["note_document", "note_update"]);

/** What the page groups records by: the row, or for a note's update its document. */
export const lineKey = (table: string, id: string, data: Record<string, unknown> | null | undefined) => {
  if (table === "note_update" && typeof data?.document_id === "string")
    return `note_document:${data.document_id}`;
  return `${table}:${id}`;
};

/** A note document's subject columns, and the table each names. */
const NOTE_SUBJECTS = [
  ["entry_id", "timeline_entry"],
  ["provider_id", "provider"],
  ["medication_id", "medication"],
  ["care_period_id", "care_period"],
  ["todo_id", "todo"],
] as const;

const localRow = async (db: AbstractPowerSyncDatabase, table: string, id: string) =>
  DEVICE_TABLES.has(table)
    ? db.getOptional<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = ?`, [id])
    : null;

/** A note's label: the title or name of the entry (or provider, medication…) it belongs to. */
const noteLabel = async (db: AbstractPowerSyncDatabase, documentId: string) => {
  const document = await localRow(db, "note_document", documentId);
  for (const [column, table] of NOTE_SUBJECTS) {
    const subjectId = document?.[column];
    if (typeof subjectId === "string") return pickLabel(await localRow(db, table, subjectId));
  }
  return null;
};

/**
 * What the row was, for the sentence on the page: the op's own title or
 * name, else the local row's (still the device's version: the server's copy
 * only replaces it after the batch is acknowledged), else null (a DELETE's
 * row is already gone).
 */
const labelFor = async (db: AbstractPowerSyncDatabase, entry: CrudEntry): Promise<string | null> => {
  const fromData = pickLabel(entry.opData);
  if (fromData) return fromData;
  if (NOTE_TABLES.has(entry.table)) {
    const documentId: unknown = entry.table === "note_document" ? entry.id : entry.opData?.document_id;
    return typeof documentId === "string" ? noteLabel(db, documentId) : null;
  }
  return pickLabel(await localRow(db, entry.table, entry.id));
};

/** Record refused ops in `unsaved_change`, one row each, in one transaction. */
const recordRefusals = async (db: AbstractPowerSyncDatabase, refused: [CrudEntry, Refusal][]) => {
  const rows = await Promise.all(
    refused.map(async ([entry, result]) => [
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.table,
      entry.id,
      entry.op,
      entry.opData ? JSON.stringify(entry.opData) : null,
      result.code,
      result.issues?.length ? JSON.stringify(result.issues) : null,
      "refused",
      await labelFor(db, entry),
      lineKey(entry.table, entry.id, entry.opData),
    ]),
  );
  await db.writeTransaction(async (tx) => {
    for (const row of rows)
      await tx.execute(
        `INSERT INTO unsaved_change
           (id, recorded_at, table_name, row_id, op, data, code, issues, outcome, label, line_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row,
      );
  });
};

/** The result for each entry: the server answers in order, one per op. */
const refusalsOf = (entries: CrudEntry[], results: UploadResult[]): [CrudEntry, Refusal][] =>
  entries.flatMap((entry, i) => {
    const result = results[i]?.id === entry.id ? results[i] : results.find((r) => r.id === entry.id);
    return result?.status === "rejected" ? [[entry, result]] : [];
  });

/**
 * Upload the next batch of queued writes through `upload`. Refused ops are
 * recorded, then the whole batch is acknowledged. A request that fails as a
 * whole (offline, a 5xx, a 401) throws: nothing is acknowledged and
 * PowerSync retries the batch later.
 */
export const uploadQueued = async (db: AbstractPowerSyncDatabase, upload: UploadCall) => {
  const batch = await db.getCrudBatch(UPLOAD_BATCH);
  if (!batch) return;
  const { results } = await upload({ ops: batch.crud.map(toOp) });
  const refused = refusalsOf(batch.crud, results);
  for (const [, result] of refused) console.warn("Sync: the server refused a change", result);
  if (refused.length) await recordRefusals(db, refused);
  await batch.complete();
};

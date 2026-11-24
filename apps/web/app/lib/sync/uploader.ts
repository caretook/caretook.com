import type { Router } from "@caretook/api";
import type { InferRouterInputs } from "@orpc/server";
import type { AbstractPowerSyncDatabase, CrudEntry } from "@powersync/web";
import type { ApiOutputs } from "../core/rpc";

import { OWN_DOSE_COPY_METADATA } from "@caretook/data/schema";
import { getTableName } from "drizzle-orm";
import { drizzleSchema } from "./schema";
import { localTryStore, tryCounter, tryKey } from "./uploadTries";

// The device's upload (PowerSync's `uploadData`), apart from the client so a
// device test can drive it with a stubbed server: it takes the database and
// the `sync.upload` call. Each op the server refuses (`rejected`, a 4xx) is
// recorded in the local-only `unsaved_change` table, with its data, the
// server's code and issues, and a label of what the row was, before the batch
// is acknowledged: the next sync then puts the server's copy back, and the
// "Changes not saved" page (Settings) still lists what was lost (B-285).
//
// An op the server couldn't process (`failed`, B-286) holds the queue only
// for a while: the ops before it are acknowledged, the try is counted
// (./uploadTries) and the upload throws, so PowerSync reports the error and
// retries. After enough tries over long enough the op is set aside: recorded
// in `unsaved_change` with its data (`set_aside`, where "Try again" can send
// it), acknowledged, and the rest of the queue carries on.

/** Ops per upload request. Matches SYNC_BATCH_LIMIT in packages/api/src/sync.ts. */
export const UPLOAD_BATCH = 100;

export type UploadInput = InferRouterInputs<Router>["sync"]["upload"];
export type UploadOutput = ApiOutputs["sync"]["upload"];
export type UploadResult = UploadOutput["results"][number];
export type UploadOp = UploadInput["ops"][number];
/** The server call: `rpc.sync.upload`, or a test's stand-in. */
export type UploadCall = (input: UploadInput) => Promise<UploadOutput>;

type Refusal = Extract<UploadResult, { status: "rejected" }>;
type Failure = Extract<UploadResult, { status: "failed" }>;
/** What `unsaved_change` keeps of a result: a refusal, or a failure set aside. */
type Unsaved = [CrudEntry, Refusal | Failure];

/** The op the server gets for one queued entry. */
const toOp = (entry: CrudEntry, ownDoses: ReadonlySet<CrudEntry>): UploadOp => {
  const metadata = ownDoses.has(entry) ? OWN_DOSE_COPY_METADATA : entry.metadata;
  return {
    op: entry.op,
    table: entry.table,
    id: entry.id,
    data: entry.opData ?? null,
    ...(metadata ? { metadata } : {}),
  };
};

/**
 * The batch's PATCHes of doses this device still holds as the writer's own
 * (B-614): the local row's author is who last wrote it, and only this device's
 * member writes here. (The PATCH can't say: it omits an `updated_by` that didn't
 * change.) The row can't have changed under a queued write, since the server's
 * copy replaces it only once the queue is empty.
 */
const ownDosePatches = async (db: AbstractPowerSyncDatabase, entries: CrudEntry[]) => {
  const patches = entries.filter((entry) => entry.table === "timeline_entry" && String(entry.op) === "PATCH");
  if (!patches.length) return new Set<CrudEntry>();
  const rows = await db.getAll<{ id: string }>(
    `SELECT id FROM timeline_entry
     WHERE kind = 'dose' AND created_by = updated_by AND id IN (SELECT value FROM json_each(?))`,
    [JSON.stringify(patches.map((entry) => entry.id))],
  );
  const own = new Set(rows.map((row) => row.id));
  return new Set(patches.filter((entry) => own.has(entry.id)));
};

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

/** Record refused and set-aside ops in `unsaved_change`, one row each, in one transaction. */
const recordUnsaved = async (db: AbstractPowerSyncDatabase, unsaved: Unsaved[]) => {
  const rows = await Promise.all(
    unsaved.map(async ([entry, result]) => [
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.table,
      entry.id,
      entry.op,
      entry.opData ? JSON.stringify(entry.opData) : null,
      result.code,
      result.status === "rejected" && result.issues?.length ? JSON.stringify(result.issues) : null,
      result.status === "rejected" ? "refused" : "set_aside",
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
const resultOf = (entries: CrudEntry[], results: UploadResult[], i: number) => {
  const id = entries[i]?.id;
  return results[i]?.id === id ? results[i] : results.find((r) => r.id === id);
};

const refusalsOf = (entries: CrudEntry[], results: UploadResult[]): Unsaved[] =>
  entries.flatMap((entry, i) => {
    const result = resultOf(entries, results, i);
    return result?.status === "rejected" ? [[entry, result]] : [];
  });

/** The first op the server couldn't process, and its result; none when every op was answered. */
const failureOf = (entries: CrudEntry[], results: UploadResult[]) => {
  for (const index of entries.keys()) {
    const result = resultOf(entries, results, index);
    if (result?.status === "failed") return { index, result };
  }
  return null;
};

/**
 * Acknowledge the first `count` ops of the queue: a batch of exactly that
 * many, read again and completed on its own (completing a batch removes
 * everything up to its last op). Nothing when `count` is 0.
 */
const acknowledgeFirst = async (
  db: AbstractPowerSyncDatabase,
  count: number,
  last: CrudEntry | undefined,
) => {
  if (count === 0) return;
  const head = await db.getCrudBatch(count);
  if (head?.crud.at(-1)?.clientId !== last?.clientId)
    throw new Error("Sync: the upload queue changed while uploading");
  await head?.complete();
};

/** Thrown after a `failed` op, so PowerSync reports the upload error and retries later. */
export class UploadFailedError extends Error {
  constructor() {
    super("Sync: the server couldn't save a change; retrying");
    this.name = "UploadFailedError";
  }
}

export type UploadOptions = {
  /** The failing op's try counter (default: kept in localStorage). */
  tries?: ReturnType<typeof tryCounter>;
  /** The clock, in epoch ms. */
  now?: () => number;
};

let deviceTries: ReturnType<typeof tryCounter> | null = null;

/**
 * Upload the next batch of queued writes through `upload`. Refused ops are
 * recorded, then the whole batch is acknowledged. After a `failed` op only
 * the ops before it are acknowledged and this throws, until the op has
 * failed often enough to be set aside (recorded, acknowledged; the queue
 * carries on). A request that fails as a whole (offline, a 5xx, a 401)
 * throws: nothing is acknowledged or counted, and PowerSync retries later.
 */
export const uploadQueued = async (
  db: AbstractPowerSyncDatabase,
  upload: UploadCall,
  { tries = (deviceTries ??= tryCounter(localTryStore())), now = Date.now }: UploadOptions = {},
) => {
  const batch = await db.getCrudBatch(UPLOAD_BATCH);
  if (!batch) return;
  const entries = batch.crud;
  const ownDoses = await ownDosePatches(db, entries);
  const { results } = await upload({ ops: entries.map((entry) => toOp(entry, ownDoses)) });

  const failure = failureOf(entries, results);
  const failedAt = failure ? failure.index : -1;
  const answered = failedAt < 0 ? entries : entries.slice(0, failedAt);
  const unsaved = refusalsOf(answered, results);
  for (const [, result] of unsaved) console.warn("Sync: the server refused a change", result);

  if (!failure) {
    if (unsaved.length) await recordUnsaved(db, unsaved);
    await batch.complete();
    tries.acknowledged(entries.map(tryKey));
    return;
  }

  const failing = entries[failedAt]!;
  const setAside = tries.fail(tryKey(failing), now());
  if (setAside) {
    console.warn("Sync: setting aside a change the server couldn't save", { table: failing.table });
    unsaved.push([failing, failure.result]);
  }
  if (unsaved.length) await recordUnsaved(db, unsaved);
  const done = setAside ? failedAt + 1 : failedAt;
  await acknowledgeFirst(db, done, entries[done - 1]);
  tries.acknowledged(entries.slice(0, done).map(tryKey));
  if (!setAside) throw new UploadFailedError();
};

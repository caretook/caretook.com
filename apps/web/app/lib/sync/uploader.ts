import type { Router } from "@caretook/api";
import type { InferRouterInputs } from "@orpc/server";
import type { AbstractPowerSyncDatabase, CrudEntry } from "@powersync/web";
import type { ApiOutputs } from "../core/rpc";

import { SYNC_WRITE_LIMIT } from "@caretook/data/domain";
import { OWN_DOSE_COPY_METADATA } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
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
//
// A request the server refuses as a whole with a 400 (B-374: one malformed
// op fails the request's input schema) would fail the same way every time
// and hold the queue forever. So the batch is sent again one op per request,
// in order: an op refused alone with a 400 is recorded as refused (with its
// data) and leaves the queue, and the others take their normal result. If a
// single-op request fails any other way (offline, a 401, a 5xx), the resend
// stops there: only the ops already answered are acknowledged, and the
// upload throws so PowerSync retries the rest.
//
// Whole writes (sync-safety-3, B-294): one save is one local transaction, and
// the server applies a write (consecutive ops sharing `write`, the entry's
// transaction id) in one transaction. So a batch never ends partway through a
// write: it holds whole writes up to UPLOAD_BATCH ops, or one write alone up
// to SYNC_WRITE_LIMIT. A write over the limit can't go whole: it is sent with
// no `write`, a hundred ops at a time, op by op as before (once the rest of it
// fits, the rest goes as one write). Every rule above then works per write:
// a refused write's ops are all recorded (the others answer
// `sync:writeRefused`); a failed write counts one try on its first entry and
// is set aside whole; a 400 resends the batch one write per request. A
// multi-op write's records share one `line_key`, so the page shows one line.

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

/**
 * The next batch: its entries in queue order, split into writes. `whole` is
 * false only for a write over the limit, whose entries go with no `write`
 * (each then its own write here too).
 */
type Batch = { entries: CrudEntry[]; writes: CrudEntry[][]; whole: boolean };

/** Whether two entries are one write: the same local transaction. */
const sameWrite = (a: CrudEntry | undefined, b: CrudEntry | undefined) =>
  a?.transactionId != null && a.transactionId === b?.transactionId;

/** Consecutive entries of one transaction are one write; with `whole` false, each entry is its own. */
const writesOf = (entries: CrudEntry[], whole: boolean) => {
  const writes: CrudEntry[][] = [];
  for (const [i, entry] of entries.entries()) {
    const last = writes.at(-1);
    if (last && whole && sameWrite(entries[i - 1], entry)) last.push(entry);
    else writes.push([entry]);
  }
  return writes;
};

const batchOf = (entries: CrudEntry[], whole: boolean): Batch => ({
  entries,
  writes: writesOf(entries, whole),
  whole,
});

/**
 * Read the queue's next batch of whole writes: up to UPLOAD_BATCH ops, read
 * one past it to tell whether the last write runs on (then the batch ends
 * before that write). A first write longer than the batch is read alone, up
 * to the limit; over it, its first UPLOAD_BATCH ops go without `write`.
 */
const nextBatch = async (db: AbstractPowerSyncDatabase): Promise<Batch | null> => {
  const read = (await db.getCrudBatch(UPLOAD_BATCH + 1))?.crud;
  if (!read?.length) return null;
  if (read.length <= UPLOAD_BATCH) return batchOf(read, true);
  let end = UPLOAD_BATCH;
  while (end > 0 && sameWrite(read[end - 1], read[end])) end--;
  if (end > 0) return batchOf(read.slice(0, end), true);

  const long = (await db.getCrudBatch(SYNC_WRITE_LIMIT + 1))?.crud ?? read;
  let size = 1;
  while (size < long.length && sameWrite(long[0], long[size])) size++;
  return size <= SYNC_WRITE_LIMIT
    ? batchOf(long.slice(0, size), true)
    : batchOf(long.slice(0, UPLOAD_BATCH), false);
};

/** The write id an entry was sent with: its transaction id, unless the batch went without. */
const writeIdOf = (batch: Batch, entry: CrudEntry) => (batch.whole ? (entry.transactionId ?? null) : null);

/** The op the server gets for one queued entry. */
const toOp = (batch: Batch, entry: CrudEntry, ownDoses: ReadonlySet<CrudEntry>): UploadOp => {
  const metadata = ownDoses.has(entry) ? OWN_DOSE_COPY_METADATA : entry.metadata;
  const write = writeIdOf(batch, entry);
  return {
    op: entry.op,
    table: entry.table,
    id: entry.id,
    data: entry.opData ?? null,
    ...(metadata ? { metadata } : {}),
    ...(write === null ? {} : { write }),
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

/** A write's records share one line when it has several ops; a single op keeps its row's line. */
const lineKeyOf = (batch: Batch, entry: CrudEntry) => {
  const write = writeIdOf(batch, entry);
  const size = batch.writes.find((ops) => ops.includes(entry))?.length ?? 1;
  return write !== null && size > 1 ? `write:${write}` : lineKey(entry.table, entry.id, entry.opData);
};

/** Record refused and set-aside ops in `unsaved_change`, one row each, in one transaction, in queue order (`write_seq`). */
const recordUnsaved = async (db: AbstractPowerSyncDatabase, batch: Batch, unsaved: Unsaved[]) => {
  if (!unsaved.length) return;
  const now = new Date().toISOString();
  const rows = await Promise.all(
    unsaved.map(async ([entry, result], seq) => [
      crypto.randomUUID(),
      now,
      entry.table,
      entry.id,
      entry.op,
      entry.opData ? JSON.stringify(entry.opData) : null,
      result.code,
      result.status === "rejected" && result.issues?.length ? JSON.stringify(result.issues) : null,
      result.status === "rejected" ? "refused" : "set_aside",
      await labelFor(db, entry),
      lineKeyOf(batch, entry),
      writeIdOf(batch, entry),
      seq,
    ]),
  );
  await db.writeTransaction(async (tx) => {
    for (const row of rows)
      await tx.execute(
        `INSERT INTO unsaved_change
           (id, recorded_at, table_name, row_id, op, data, code, issues, outcome, label, line_key, write_id, write_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row,
      );
  });
};

/** The result for each entry: the server answers in order, one per op. */
const resultOf = (entries: CrudEntry[], results: UploadResult[], i: number) => {
  const id = entries[i]?.id;
  return results[i]?.id === id ? results[i] : results.find((r) => r.id === id);
};

/** The ops the server refused, each with its result; one refused op's write answers `sync:writeRefused` too. */
const refusalsOf = (entries: CrudEntry[], results: UploadResult[]): Unsaved[] =>
  entries.flatMap((entry, i) => {
    const result = resultOf(entries, results, i);
    return result?.status === "rejected" ? [[entry, result]] : [];
  });

const warnRefusals = (unsaved: Unsaved[]) => {
  for (const [, result] of unsaved)
    if (result.code !== "sync:writeRefused") console.warn("Sync: the server refused a change", result);
};

/** The first op the server couldn't process (a write's first op), and its result; none when every op was answered. */
const failureOf = (entries: CrudEntry[], results: UploadResult[]) => {
  for (const index of entries.keys()) {
    const result = resultOf(entries, results, index);
    if (result?.status === "failed") return { index, result };
  }
  return null;
};

/** A failed write set aside: every op recorded with the failure. */
const setAsideAll = (write: CrudEntry[], failure: Failure): Unsaved[] =>
  write.map((entry) => [entry, { ...failure, id: entry.id }]);

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
  /** The failing write's try counter (default: kept in localStorage). */
  tries?: ReturnType<typeof tryCounter>;
  /** The clock, in epoch ms. */
  now?: () => number;
};

let deviceTries: ReturnType<typeof tryCounter> | null = null;

/** The server refused the request itself as malformed: it would fail the same way again. */
const isBadRequest = (e: unknown): e is ORPCError<string, unknown> =>
  e instanceof ORPCError && e.status === 400;

type Issue = { path: string; message: string };

/**
 * A one-write request's 400 as the write's refusal, as the server answers a
 * refused write: each op its issues name answers `sync:invalid` with them
 * (paths relative to the op), the others `sync:writeRefused` naming the
 * first. Issues that name no op go to the write's first op.
 */
const refusalsOfBadRequest = (write: CrudEntry[], e: ORPCError<string, unknown>): Refusal[] => {
  const raw = (e.data as { issues?: { path?: unknown; message?: unknown }[] } | undefined)?.issues ?? [];
  const byOp = new Map<number, Issue[]>();
  for (const issue of raw) {
    if (typeof issue.message !== "string") continue;
    const parts = Array.isArray(issue.path)
      ? issue.path.map((part: unknown) =>
          typeof part === "object" && part !== null && "key" in part ? String(part.key) : String(part),
        )
      : [];
    const named = parts[0] === "ops" ? Number(parts[1]) : NaN;
    const index = Number.isInteger(named) && named >= 0 && named < write.length ? named : 0;
    const relative = parts[0] === "ops" ? parts.slice(2) : parts;
    byOp.set(index, [...(byOp.get(index) ?? []), { path: relative.join("."), message: issue.message }]);
  }
  const refused = byOp.size ? Math.min(...byOp.keys()) : 0;
  return write.map((entry, i): Refusal => {
    const issues = byOp.get(i);
    if (i === refused || issues)
      return { id: entry.id, status: "rejected", code: "sync:invalid", ...(issues ? { issues } : {}) };
    return { id: entry.id, status: "rejected", code: "sync:writeRefused", refusedId: write[refused]!.id };
  });
};

/**
 * After a 400 for the whole request: send the batch again one write per
 * request, in order (see the notes at the top). `refused` is that 400, used
 * as is when the batch is a single write.
 */
const uploadWriteByWrite = async (
  db: AbstractPowerSyncDatabase,
  batch: Batch,
  ops: UploadOp[],
  upload: UploadCall,
  refused: ORPCError<string, unknown>,
  { tries, now }: Required<UploadOptions>,
) => {
  const { entries, writes } = batch;
  const unsaved: Unsaved[] = [];
  /** Stop after the first `done` ops: record, acknowledge them, and let PowerSync retry the rest. */
  const stopAt = async (done: number) => {
    await recordUnsaved(db, batch, unsaved);
    await acknowledgeFirst(db, done, entries[done - 1]);
    tries.acknowledged(entries.slice(0, done).map(tryKey));
  };

  let at = 0;
  for (const write of writes) {
    const start = at;
    at += write.length;
    let results: UploadResult[];
    try {
      if (writes.length === 1) throw refused;
      ({ results } = await upload({ ops: ops.slice(start, at) }));
    } catch (e) {
      if (!isBadRequest(e)) {
        await stopAt(start);
        throw e;
      }
      results = refusalsOfBadRequest(write, e);
    }
    const failure = failureOf(write, results);
    if (failure) {
      if (!tries.fail(tryKey(write[0]!), now())) {
        await stopAt(start);
        throw new UploadFailedError();
      }
      console.warn("Sync: setting aside a change the server couldn't save", { table: write[0]!.table });
      unsaved.push(...setAsideAll(write, failure.result));
      continue;
    }
    const refusals = refusalsOf(write, results);
    warnRefusals(refusals);
    unsaved.push(...refusals);
  }
  await stopAt(entries.length);
};

/**
 * Upload the next batch of queued writes through `upload`. Refused ops are
 * recorded, then the whole batch is acknowledged. After a `failed` write only
 * the ops before it are acknowledged and this throws, until the write has
 * failed often enough to be set aside (recorded whole, acknowledged; the queue
 * carries on). A 400 for the whole request resends the batch one write at a
 * time. A request that fails as a whole any other way (offline, a 5xx, a
 * 401) throws: nothing is acknowledged or counted, and PowerSync retries later.
 */
export const uploadQueued = async (
  db: AbstractPowerSyncDatabase,
  upload: UploadCall,
  { tries = (deviceTries ??= tryCounter(localTryStore())), now = Date.now }: UploadOptions = {},
) => {
  const batch = await nextBatch(db);
  if (!batch) return;
  const { entries } = batch;
  const ownDoses = await ownDosePatches(db, entries);
  const ops = entries.map((entry) => toOp(batch, entry, ownDoses));
  let results: UploadResult[];
  try {
    ({ results } = await upload({ ops }));
  } catch (e) {
    if (!isBadRequest(e)) throw e;
    console.warn("Sync: the server refused an upload as a whole; sending its writes one at a time", e);
    return uploadWriteByWrite(db, batch, ops, upload, e, { tries, now });
  }

  const failure = failureOf(entries, results);
  // The server answers `failed` at the write's first op; the write is every op of it.
  const write = failure ? (batch.writes.find((ops) => ops.includes(entries[failure.index]!)) ?? []) : [];
  const failedAt = failure ? entries.indexOf(write[0]!) : entries.length;
  const unsaved = refusalsOf(entries.slice(0, failedAt), results);
  warnRefusals(unsaved);

  if (!failure) {
    await recordUnsaved(db, batch, unsaved);
    await acknowledgeFirst(db, entries.length, entries.at(-1));
    tries.acknowledged(entries.map(tryKey));
    return;
  }

  const setAside = tries.fail(tryKey(write[0]!), now());
  if (setAside) {
    console.warn("Sync: setting aside a change the server couldn't save", { table: write[0]!.table });
    unsaved.push(...setAsideAll(write, failure.result));
  }
  await recordUnsaved(db, batch, unsaved);
  const done = setAside ? failedAt + write.length : failedAt;
  await acknowledgeFirst(db, done, entries[done - 1]);
  tries.acknowledged(entries.slice(0, done).map(tryKey));
  if (!setAside) throw new UploadFailedError();
};

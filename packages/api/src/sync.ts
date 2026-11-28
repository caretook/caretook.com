import type { AppError } from "@caretook/data";
import type { Outcome } from "./syncRegistry";

import {
  ERRORS,
  initClient,
  isError,
  logError,
  newError,
  noteDocumentService,
  withTransaction,
} from "@caretook/data";
import { SYNC_WRITE_LIMIT } from "@caretook/data/domain";
import { z } from "zod";
import { unwrap } from "./errors";
import { authedProcedure } from "./procedures";
import { applyOp, text } from "./syncRegistry";

// PowerSync's upload queue. A device writes to its local SQLite, PowerSync
// queues each change as a CRUD op, and the client posts them here in order.
// Each op goes through its table's handler in the upload registry
// (syncRegistry.ts), and so through the services: RBAC and validation apply
// exactly as they do for the timeline procedures.
//
// Writes: consecutive ops with the same `write` (the device's local
// transaction id: one save) are one write; an op with no `write` is a write
// of its own. Each write runs in one transaction, so a save lands whole or
// not at all. Results stay one per op, in order.
//
// Outcomes:
// - applied: the write committed; every op of it is in Postgres.
// - rejected: the services refused an op (invalid, not allowed, not
//   found…), so the whole write rolled back. The refused op answers its own
//   code; every other op of the write answers `sync:writeRefused` with the
//   refused op's id (`refusedId`). They are still acknowledged: PowerSync
//   then replaces the device's copy with the server's, so a refused save
//   disappears instead of blocking the queue forever. The device records it
//   as not saved first. The loop goes on with the next write.
// - failed: the server couldn't process the write (a throw, or a service
//   error that isn't a 4xx). It rolls back and the loop stops there: the
//   results so far come back with a 200, `failed` at the write's first op,
//   and the ops after that get none. The device acknowledges the ops before
//   it and retries the write, and sets it aside after a few tries (B-286),
//   so one bad save never holds the rest of the queue. A deadlock or
//   serialization failure (another member's write clashing with this one)
//   is retried once first.
// - An outage is nobody's op: before answering `failed` the server probes
//   the database, and if that fails too the whole request is a 5xx, which
//   the device never counts against an op.
// A NUL character anywhere in an op's data refuses that op up front, before
// its write's transaction opens (Postgres can't store it in text or jsonb,
// so it would fail every time).

/** Ops per request, unless every op is one write (then up to `SYNC_WRITE_LIMIT`). */
export const SYNC_BATCH_LIMIT = 100;

const crudOpZSchema = z.object({
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.string().max(64),
  id: z.uuid(),
  // Column values as SQLite stores them (snake_case, JSON as text).
  data: z.record(z.string(), z.unknown()).nullish(),
  // The write's client-side flag (PowerSync's `_metadata`, on tables that track it).
  metadata: z.string().max(64).nullish(),
  // The device's transaction id: consecutive ops sharing it are one write.
  write: z.number().int().nonnegative().nullish(),
});
export type CrudOp = z.infer<typeof crudOpZSchema>;

export type CrudResult =
  | { id: string; status: "applied" }
  | {
      id: string;
      status: "rejected";
      code: string;
      issues?: { path: string; message: string }[];
      /** `sync:writeRefused` only: the op of this write that was refused. */
      refusedId?: string;
    }
  | { id: string; status: "failed"; code: "sync:failed" };

/** 4xx service errors are the client's problem: acknowledge and move on. */
const isRejection = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number }).statusCode ?? 500;
  return status >= 400 && status < 500;
};

/**
 * Compact the documents this batch added updates to, when they're due. Only
 * applied ops count, and an op is applied only when its write committed.
 * Best effort: the updates are already stored, so a failure here only
 * delays compaction until the next upload.
 */
const compactTouched = async (ops: CrudOp[], results: CrudResult[]) => {
  const ids = new Set(
    ops.flatMap((op, i) =>
      op.table === "note_update" && results[i]?.status === "applied" ? [text(op.data?.document_id)] : [],
    ),
  );
  for (const id of ids) {
    if (!id) continue;
    const res = await noteDocumentService.compactIfDue(id);
    if (isError(res)) logError("sync: live document compaction failed", res, { recordId: id });
  }
};

const NUL = "\u0000";

/** Where a NUL character is in a value: its path, or null. JSON text is read as JSON (`\u0000` escaped). */
const nulPath = (value: unknown, path: string): string | null => {
  if (typeof value === "string") {
    if (value.includes(NUL)) return path;
    if (!value.includes("\\u0000") || !/^\s*[[{]/.test(value)) return null;
    try {
      return nulPath(JSON.parse(value), path);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = nulPath(item, `${path}.${i}`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const found = nulPath(key, path) ?? nulPath(item, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }
  return null;
};

const nulRefusal = (op: CrudOp): AppError | null => {
  const path = nulPath(op.data, "");
  return path === null
    ? null
    : newError({
        code: "sync:invalid",
        meta: { issues: [{ path, message: "Contains a character that can't be saved" }] },
      });
};

/** One op's outcome; a throw is an unexpected failure, as a non-4xx service error is. */
const runOp = async (context: Parameters<typeof applyOp>[0], op: CrudOp): Promise<Outcome> => {
  try {
    return await applyOp(context, op);
  } catch (cause) {
    return isError(cause) ? cause : newError({ code: "sync:failed", cause });
  }
};

const rejected = (op: CrudOp, error: AppError): CrudResult => {
  const issues = (error.meta as { issues?: { path: string; message: string }[] } | undefined)?.issues;
  return { id: op.id, status: "rejected", code: error.code, ...(issues ? { issues } : {}) };
};

/** The ops in order, cut into writes: a run of one `write`, or one op without. */
const writesOf = (ops: CrudOp[]) => {
  const writes: CrudOp[][] = [];
  for (const op of ops) {
    const last = writes.at(-1);
    const id = op.write ?? null;
    if (last && id !== null && last[0]!.write === id) last.push(op);
    else writes.push([op]);
  }
  return writes;
};

/** One write per request may pass the batch limit: every op shares one `write`. */
const oneWrite = (ops: CrudOp[]) => {
  const id = ops[0]?.write;
  return id !== null && id !== undefined && ops.every((op) => op.write === id);
};

/** Postgres's deadlock and serialization failures: a clash with another write, worth one more try. */
const RETRYABLE = new Set(["40P01", "40001"]);
const MAX_CAUSES = 6;

/** Whether `error`, or anything in its cause chain, is a deadlock or serialization failure. */
const isClash = (error: unknown) => {
  let at: unknown = error;
  for (let i = 0; i < MAX_CAUSES && at && typeof at === "object"; i++) {
    const code = (at as { code?: unknown }).code;
    if (typeof code === "string" && RETRYABLE.has(code)) return true;
    at = (at as { cause?: unknown }).cause;
  }
  return false;
};

type WriteOutcome = { ok: true } | { at: number; error: AppError };

/**
 * One write in one transaction: every op through its handler with the
 * write's `tx`, rolled back at the first op that isn't applied (that op's
 * index and error). A NUL refuses before the transaction opens.
 */
const applyWrite = async (
  context: Omit<Parameters<typeof applyOp>[0], "tx">,
  ops: CrudOp[],
): Promise<WriteOutcome> => {
  for (const [at, op] of ops.entries()) {
    const refusal = nulRefusal(op);
    if (refusal) return { at, error: refusal };
  }
  let stopped: { at: number; error: AppError } | undefined;
  const res = await withTransaction(async (tx) => {
    for (const [at, op] of ops.entries()) {
      const outcome = await runOp({ ...context, tx }, op);
      if (isError(outcome)) {
        stopped = { at, error: outcome };
        return outcome;
      }
    }
    return { ok: true as const };
  });
  // The commit itself failing is the write's, not one op's.
  return stopped ?? (isError(res) ? { at: 0, error: res } : { ok: true });
};

export const sync = {
  /** Apply a device's queued changes, in order, a write at a time. See the notes at the top of this file. */
  upload: authedProcedure
    .input(
      z.object({
        ops: z
          .array(crudOpZSchema)
          .max(SYNC_WRITE_LIMIT)
          .refine((ops) => ops.length <= SYNC_BATCH_LIMIT || oneWrite(ops), {
            message: `More than ${SYNC_BATCH_LIMIT} changes must all be one write`,
          }),
      }),
    )
    .handler(async ({ context, input }) => {
      const results: CrudResult[] = [];
      for (const ops of writesOf(input.ops)) {
        let outcome = await applyWrite(context, ops);
        if ("error" in outcome && !isRejection(outcome.error) && isClash(outcome.error))
          outcome = await applyWrite(context, ops);
        if (!("error" in outcome)) {
          for (const op of ops) results.push({ id: op.id, status: "applied" });
          continue;
        }
        const { at, error } = outcome;
        const refused = ops[at]!;
        if (isRejection(error)) {
          for (const op of ops)
            results.push(
              op === refused
                ? rejected(op, error)
                : { id: op.id, status: "rejected", code: "sync:writeRefused", refusedId: refused.id },
            );
          continue;
        }
        logError("sync: an upload write failed", error, { procedure: "sync.upload", recordId: refused.id });
        // An outage, not this write: the whole request fails, and the device counts no try.
        const probe = await initClient();
        if (isError(probe)) unwrap(probe);
        results.push({ id: ops[0]!.id, status: "failed", code: "sync:failed" });
        break;
      }
      await compactTouched(input.ops, results);
      return { results };
    }),
};

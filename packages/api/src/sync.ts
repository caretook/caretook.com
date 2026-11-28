import type { AppError } from "@caretook/data";
import type { Outcome } from "./syncRegistry";

import { ERRORS, initClient, isError, logError, newError, noteDocumentService } from "@caretook/data";
import { z } from "zod";
import { unwrap } from "./errors";
import { limitedProcedure } from "./procedures";
import { applyOp, text } from "./syncRegistry";

// PowerSync's upload queue. A device writes to its local SQLite, PowerSync
// queues each change as a CRUD op, and the client posts them here in order.
// Each op goes through its table's handler in the upload registry
// (syncRegistry.ts), and so through the services: RBAC and validation apply
// exactly as they do for the timeline procedures.
//
// Outcomes:
// - applied: the change is in Postgres.
// - rejected: the services refused it (invalid, not allowed, not found…).
//   The op is still acknowledged. PowerSync then replaces the device's copy
//   with the server's, so a refused change disappears instead of blocking
//   the queue forever. The device records it as not saved first.
// - failed: the server couldn't process this one op (a throw, or a service
//   error that isn't a 4xx). The loop stops there: the results so far come
//   back with a 200, and the ops after it get none. The device acknowledges
//   the ops before it and retries this one, and sets it aside after a few
//   tries (B-286), so one bad op never holds the rest of the queue.
// - An outage is nobody's op: before answering `failed` the server probes
//   the database, and if that fails too the whole request is a 5xx, which
//   the device never counts against an op.
// A NUL character anywhere in an op's data is rejected up front (Postgres
// can't store it in text or jsonb, so it would fail every time).

export const SYNC_BATCH_LIMIT = 100;

const crudOpZSchema = z.object({
  op: z.enum(["PUT", "PATCH", "DELETE"]),
  table: z.string().max(64),
  id: z.uuid(),
  // Column values as SQLite stores them (snake_case, JSON as text).
  data: z.record(z.string(), z.unknown()).nullish(),
  // The write's client-side flag (PowerSync's `_metadata`, on tables that track it).
  metadata: z.string().max(64).nullish(),
});
export type CrudOp = z.infer<typeof crudOpZSchema>;

export type CrudResult =
  | { id: string; status: "applied" }
  | { id: string; status: "rejected"; code: string; issues?: { path: string; message: string }[] }
  | { id: string; status: "failed"; code: "sync:failed" };

/** 4xx service errors are the client's problem: acknowledge and move on. */
const isRejection = (error: AppError) => {
  const status = (ERRORS[error.code] as { statusCode?: number }).statusCode ?? 500;
  return status >= 400 && status < 500;
};

/**
 * Compact the documents this batch added updates to, when they're due.
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
  const refusal = nulRefusal(op);
  if (refusal) return refusal;
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

export const sync = {
  /** Apply a device's queued changes, in order. See the notes at the top of this file. */
  upload: limitedProcedure("sync")
    .input(z.object({ ops: z.array(crudOpZSchema).max(SYNC_BATCH_LIMIT) }))
    .handler(async ({ context, input }) => {
      const results: CrudResult[] = [];
      for (const op of input.ops) {
        const outcome = await runOp(context, op);
        if (!isError(outcome)) {
          results.push({ id: op.id, status: "applied" });
          continue;
        }
        if (isRejection(outcome)) {
          results.push(rejected(op, outcome));
          continue;
        }
        logError("sync: an upload op failed", outcome, { procedure: "sync.upload", recordId: op.id });
        // An outage, not this op: the whole request fails, and the device counts no try.
        const probe = await initClient();
        if (isError(probe)) unwrap(probe);
        results.push({ id: op.id, status: "failed", code: "sync:failed" });
        break;
      }
      await compactTouched(input.ops, results);
      return { results };
    }),
};

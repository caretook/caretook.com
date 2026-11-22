import type { AppError } from "@caretook/data";
import type { Outcome } from "./syncRegistry";

import { ERRORS, isError, logError, noteDocumentService } from "@caretook/data";
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
// Outcomes:
// - applied: the change is in Postgres.
// - rejected: the services refused it (invalid, not allowed, not found…).
//   The op is still acknowledged. PowerSync then replaces the device's copy
//   with the server's, so a refused change disappears instead of blocking
//   the queue forever.
// - Anything else (the database is down) throws, and the client retries the
//   whole batch later. Ops are idempotent, so the ones already applied are
//   harmless to replay.

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
  | { id: string; status: "rejected"; code: string; issues?: { path: string; message: string }[] };

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

const toResult = (op: CrudOp, outcome: Outcome): CrudResult => {
  if (!isError(outcome)) return { id: op.id, status: "applied" };
  // Unexpected failures throw (as a 500): the client retries the batch.
  if (!isRejection(outcome)) unwrap(outcome);
  const issues = (outcome.meta as { issues?: { path: string; message: string }[] } | undefined)?.issues;
  return { id: op.id, status: "rejected", code: outcome.code, ...(issues ? { issues } : {}) };
};

export const sync = {
  /** Apply a device's queued changes, in order. See the notes at the top of this file. */
  upload: authedProcedure
    .input(z.object({ ops: z.array(crudOpZSchema).max(SYNC_BATCH_LIMIT) }))
    .handler(async ({ context, input }) => {
      const results: CrudResult[] = [];
      for (const op of input.ops) results.push(toResult(op, await applyOp(context, op)));
      await compactTouched(input.ops, results);
      return { results };
    }),
};

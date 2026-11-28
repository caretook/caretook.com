import type { NoteDocument, NoteDocumentSubject, Tx } from "../../db";

import { eq, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import {
  carePeriodSchema,
  medicationSchema,
  noteDocumentSchema,
  noteUpdateSchema,
  providerSchema,
  timelineEntrySchema,
  todoSchema,
} from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "noteDocumentSchema";

export const dbToModel = (row: NoteDocument) => row;

// Writes go through noteDocumentService, which checks the entry.
export const { create, get, getById, list, update, remove } = baseModel.getFunctions({
  schemaName,
  dbToModel,
});

/** Many documents in one INSERT (a series' visits: B-755). */
export const createMany = baseModel.createMany({ schemaName, dbToModel });

// ---------------------------------------------------------------------------
// Compaction helpers. Internal: no permission scope, so only services
// running as the system call them.
// ---------------------------------------------------------------------------

/**
 * Lock the document row for the rest of `tx`, so two compactions of the same
 * document take turns. Returns the row, or null if it's gone.
 */
export const lockForCompaction = async (id: string, tx: Tx) => {
  const t = noteDocumentSchema;
  const rows = await dbMayFail(
    () => txOrDb(tx).select().from(t).where(eq(t.id, id)).for("update"),
    "noteDocumentModel:lock",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? null;
};

const OWNER_TABLES = {
  entry: timelineEntrySchema,
  provider: providerSchema,
  medication: medicationSchema,
  carePeriod: carePeriodSchema,
  todo: todoSchema,
} as const;

/**
 * Lock a document's owner row `FOR SHARE` for the rest of `tx` (B-1053), so
 * an append can't overlap the owner's delete: a delete committed first is
 * seen here (its `deletedAt`), and one that starts later waits for the
 * append to commit, then its scrub trigger clears what the append wrote.
 * Returns `{ deletedAt }`, or null if the owner is gone. No permission
 * scope: the caller has already checked the actor sees the document.
 */
export const lockOwner = async (subject: NoteDocumentSubject, id: string, tx: Tx) => {
  const t = OWNER_TABLES[subject];
  const rows = await dbMayFail(
    () => txOrDb(tx).select({ deletedAt: t.deletedAt }).from(t).where(eq(t.id, id)).for("share"),
    "noteDocumentModel:lockOwner",
  );
  if (isError(rows)) return rows;
  return rows[0] ?? null;
};

/** How many updates wait to be compacted, and how old the oldest is (seconds). */
export const pendingUpdates = async (id: string, tx?: Tx) => {
  const u = noteUpdateSchema;
  const rows = await dbMayFail(
    () =>
      txOrDb(tx)
        .select({
          count: sql<number>`count(*)::int`,
          oldestAgeSeconds: sql<number | null>`extract(epoch from now() - min(${u.createdAt}))::float`,
        })
        .from(u)
        .where(eq(u.documentId, id)),
    "noteDocumentModel:pending",
  );
  if (isError(rows)) return rows;
  return { count: rows[0]?.count ?? 0, oldestAgeSeconds: rows[0]?.oldestAgeSeconds ?? null };
};

/** The group's documents with updates waiting to be compacted (any owner: entry, provider, medication, …). */
export const pendingDocumentIds = async (groupId: string, tx?: Tx) => {
  const u = noteUpdateSchema;
  const rows = await dbMayFail(
    () => txOrDb(tx).selectDistinct({ id: u.documentId }).from(u).where(eq(u.groupId, groupId)),
    "noteDocumentModel:pending",
  );
  return isError(rows) ? rows : rows.map((r) => r.id);
};

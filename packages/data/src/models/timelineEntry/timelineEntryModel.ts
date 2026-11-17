import type { TimelineEntry } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { timelineEntrySchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import { isSystemUser, rejectError } from "../../permissions";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "timelineEntrySchema";
type K = typeof schemaName;

export const dbToModel = (row: TimelineEntry) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted rows are hidden unless a read asks for them. */
export type IncludeDeleted = { includeDeleted?: boolean };

const live = (filter: Filter<K> | undefined, opts: IncludeDeleted = {}): Filter<K> | undefined =>
  opts.includeDeleted ? filter : { ...filter, deletedAt: { type: "isNull" } };

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const get = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.get({ ...args, filter: live(args.filter, args) });

export const getById = (id: string, args: Omit<QuerySelectArgs<K>, "filter"> & IncludeDeleted) =>
  get({ ...args, filter: { id: { type: "eq", value: id } } });

export type TimelineCursor = { occurredAt: string; id: string };

// Postgres timestamptz text ("2026-11-17 10:00:00.123+00") or ISO 8601.
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/;
const cursorZSchema = z.tuple([z.string().regex(TIMESTAMP_RE), z.uuid()]);

/** An opaque page cursor: the last row's (occurredAt, id). */
export const encodeCursor = ({ occurredAt, id }: TimelineCursor) =>
  Buffer.from(JSON.stringify([occurredAt, id])).toString("base64url");

export const decodeCursor = (cursor: string) => {
  try {
    const parsed = cursorZSchema.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.success) return { occurredAt: parsed.data[0], id: parsed.data[1] };
  } catch {
    // Falls through to the error below.
  }
  return newError({ code: "timelineEntryModel:badCursor" });
};

export type ListPageArgs = Omit<QuerySelectArgs<K>, "orderBy" | "paginate" | "with"> &
  IncludeDeleted & {
    /** From the previous page's `nextCursor`. */
    cursor?: string | null;
    limit?: number;
  };

/**
 * Newest first, keyset-paginated on (occurredAt, id). Offset paging would
 * skip or repeat rows when an offline device uploads older entries between
 * page loads; a keyset cursor doesn't.
 */
export const listPage = async (args: ListPageArgs) => {
  const limit = Math.min(Math.max(Math.trunc(args.limit ?? DEFAULT_PAGE_SIZE) || 1, 1), MAX_PAGE_SIZE);

  const cursor = args.cursor ? decodeCursor(args.cursor) : null;
  if (isError(cursor)) return cursor;

  const where = generateQueryWhere(schemaName, "list", { ...args, filter: live(args.filter, args) });
  if (isError(where)) return where;

  const t = timelineEntrySchema;
  const after = cursor
    ? sql`(${t.occurredAt}, ${t.id}) < (${cursor.occurredAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined;

  const rows = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .select()
        .from(t)
        .where(and(where, after))
        .orderBy(desc(t.occurredAt), desc(t.id))
        .limit(limit + 1),
    "timelineEntryModel:list",
  );
  if (isError(rows)) return rows;

  const page = rows.slice(0, limit).map(dbToModel);
  const last = page.at(-1);
  return {
    data: page,
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
};

// ---------------------------------------------------------------------------
// Writes. Writes go through timelineEntryService, which validates content.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted entries can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission (not update, where `deletedAt` is system-only). The row stays
 * so the deletion syncs to other devices.
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = timelineEntrySchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "timelineEntryModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};

/** Hard delete, for retention jobs and data-deletion requests. System only. */
export const purge = (args: QuerySelectArgs<K>) =>
  isSystemUser(args.authUser) ? base.remove(args) : Promise.resolve(rejectError(args.authUser));

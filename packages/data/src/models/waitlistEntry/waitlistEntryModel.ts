import type { Tx, WaitlistEntry, WaitlistEntryInsert } from "../../db";
import type { WaitlistFilter } from "../../db/schema";
import type { Paginate, QueryCommonArgs } from "../base/queryHelpers";

import { and, count, desc, gte, isNull, lt, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { waitlistEntrySchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, paginate } from "../base/queryHelpers";

export const schemaName = "waitlistEntrySchema";

export const dbToModel = (row: WaitlistEntry) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Staff (global admin) read and remove entries; only the system writes them,
// through `upsertByEmail` below.
export const { get, getById, list, remove } = base;

const t = waitlistEntrySchema;

/**
 * Add `data.email` to the waitlist, or update its entry: a field left out
 * keeps its earlier value. Unscoped, as the system: the public waitlist form
 * is what entitles someone to this (waitlistService.join). `data.email` must
 * already be normalized (trimmed and lowercased).
 */
export const upsertByEmail = async (data: WaitlistEntryInsert, opts: { tx?: Tx } = {}) => {
  const res = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .insert(t)
        .values({ ...data, createdBy: SYSTEM_USER.id, updatedBy: SYSTEM_USER.id })
        .onConflictDoUpdate({
          target: t.email,
          set: {
            firstName: sql`coalesce(excluded.first_name, ${t.firstName})`,
            caringFor: sql`coalesce(excluded.caring_for, ${t.caringFor})`,
            heardFrom: sql`coalesce(excluded.heard_from, ${t.heardFrom})`,
            source: sql`coalesce(excluded.source, ${t.source})`,
            updatedBy: SYSTEM_USER.id,
            updatedAt: sql`now()`,
          },
        })
        .returning(),
    "waitlistEntryModel:upsertByEmail",
  );
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : newError({ code: "baseModel:create:nothingCreated" });
};

/** `value` as a literal ILIKE pattern: its `%`, `_` and backslash match only themselves. */
const containsPattern = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The start of `day` (YYYY-MM-DD, UTC) plus `addDays`, as ISO 8601. */
const dayStart = (day: string, addDays = 0) => {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + addDays);
  return at.toISOString();
};

/** The SQL for a waitlist filter (see `waitlistFilterZSchema`). */
const filterSql = (filter: Partial<WaitlistFilter>) =>
  and(
    filter.from ? gte(t.createdAt, dayStart(filter.from)) : undefined,
    filter.to ? lt(t.createdAt, dayStart(filter.to, 1)) : undefined,
    filter.caringFor === "none"
      ? isNull(t.caringFor)
      : filter.caringFor
        ? sql`${t.caringFor} = ${filter.caringFor}`
        : undefined,
    filter.source
      ? sql`exists (select 1 from jsonb_each_text(coalesce(${t.source}, '{}'::jsonb)) as s(key, value) where s.value ilike ${containsPattern(filter.source)})`
      : undefined,
  );

/**
 * Staff: the entries matching `filter`, newest first, with their count. In
 * the actor's list scope (global admin only), like every read.
 */
export const search = async (
  args: QueryCommonArgs & { filter?: Partial<WaitlistFilter>; paginate?: Paginate },
) => {
  const scope = generateQueryWhere(schemaName, "list", { authUser: args.authUser });
  if (isError(scope)) return scope;
  const where = and(scope, filterSql(args.filter ?? {}));

  const rows = await dbMayFail(() => {
    const query = txOrDb(args.tx).select().from(t).where(where).orderBy(desc(t.createdAt), desc(t.id));
    const page = paginate(args);
    return page.limit === undefined ? query : query.limit(page.limit).offset(page.offset);
  }, "waitlistEntryModel:search");
  if (isError(rows)) return rows;

  const total = await dbMayFail(
    () => txOrDb(args.tx).select({ count: count() }).from(t).where(where),
    "waitlistEntryModel:search",
  );
  if (isError(total)) return total;

  return { count: total[0]?.count ?? 0, data: rows.map(dbToModel) };
};

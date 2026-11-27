import type { AppointmentSeries, Tx } from "../../db";
import type { Filter, QuerySelectArgs } from "../base/queryHelpers";

import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import { appointmentSeriesSchema } from "../../db/schema";
import { isError, newError } from "../../errors";
import * as baseModel from "../base";
import { generateQueryWhere, isFilterEmpty } from "../base/queryHelpers";

export const schemaName = "appointmentSeriesSchema";
type K = typeof schemaName;

export const dbToModel = (row: AppointmentSeries) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

/** Soft-deleted series are hidden unless a read asks for them. */
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

/** Storage order (the first day, then id). */
export const DEFAULT_ORDER = [
  { field: "startsOn", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

export const list = (args: QuerySelectArgs<K> & IncludeDeleted) =>
  base.list({ ...args, filter: live(args.filter, args), orderBy: args.orderBy ?? [...DEFAULT_ORDER] });

// ---------------------------------------------------------------------------
// The top-up's reads (appointmentSeriesService.topUp, as the system): plain
// queries with no per-page COUNT, since the run stops on a short page.
// ---------------------------------------------------------------------------

/** Where a top-up page starts: after this series, in (`toppedUpThrough`, `id`) order. */
export type TopUpCursor = { toppedUpThrough: string; id: string };

const topUpLive = () => {
  const t = appointmentSeriesSchema;
  return and(isNull(t.deletedAt), eq(t.kind, "event"));
};

/**
 * The zones of live event series topped up through `from` or later and
 * before `to`: the band where being due depends on the series' own zone.
 */
export const topUpZones = (from: string, to: string, opts: { tx?: Tx } = {}) => {
  const t = appointmentSeriesSchema;
  return dbMayFail(
    () =>
      txOrDb(opts.tx)
        .selectDistinct({ timeZone: t.timeZone })
        .from(t)
        .where(and(topUpLive(), gte(t.toppedUpThrough, from), lt(t.toppedUpThrough, to))),
    "appointmentSeriesModel:topUpZones",
  );
};

/**
 * A page of the live event series a top-up has work for, oldest edge first,
 * after `after`: topped up through a day before `before`, or before a later
 * edge for the zones listed with it (`edges`). A series past its UNTIL is
 * left out: one whose UNTIL is before both the day after its edge and
 * `from` (the earliest today any zone has) has no visit left to write.
 */
export const listDueForTopUp = (args: {
  before: string;
  edges: { zones: string[]; before: string }[];
  from: string;
  after?: TopUpCursor;
  limit: number;
  tx?: Tx;
}) => {
  const t = appointmentSeriesSchema;
  const due = or(
    lt(t.toppedUpThrough, args.before),
    ...args.edges
      .filter((e) => e.zones.length)
      .map((e) => and(inArray(t.timeZone, e.zones), lt(t.toppedUpThrough, e.before))),
  );
  // UNTIL is "YYYYMMDD" (repeatRule.ts), so it compares as text.
  const until = sql`substring(${t.rule} from 'UNTIL=([0-9]{8})')`;
  const notEnded = sql`coalesce(${until} >= greatest(to_char(${t.toppedUpThrough} + 1, 'YYYYMMDD'), ${args.from.replaceAll("-", "")}), true)`;
  const after = args.after
    ? sql`(${t.toppedUpThrough}, ${t.id}) > (${args.after.toppedUpThrough}::date, ${args.after.id}::uuid)`
    : undefined;
  return dbMayFail(
    () =>
      txOrDb(args.tx)
        .select()
        .from(t)
        .where(and(topUpLive(), due, notEnded, after))
        .orderBy(asc(t.toppedUpThrough), asc(t.id))
        .limit(args.limit),
    "appointmentSeriesModel:listDueForTopUp",
  );
};

// ---------------------------------------------------------------------------
// Writes go through appointmentSeriesService, which validates the rule and
// the template, checks the providers and writes the visits.
// ---------------------------------------------------------------------------

export const { create } = base;

/** Deleted series can't be edited. */
export const update = (args: Parameters<typeof base.update>[0]) =>
  base.update({ ...args, filter: live(args.filter) });

/**
 * Soft delete: sets `deletedAt`, checked against the table's **delete**
 * permission. The row stays so the deletion syncs.
 */
export const remove = async (args: QuerySelectArgs<K>) => {
  if (isFilterEmpty(args.filter)) return newError({ code: "baseModel:noFilter" });

  const where = generateQueryWhere(schemaName, "delete", { ...args, filter: live(args.filter) });
  if (isError(where)) return where;

  const t = appointmentSeriesSchema;
  const res = await dbMayFail(
    () =>
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql`now()`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning({ id: t.id }),
    "appointmentSeriesModel:remove",
  );
  if (isError(res)) return res;
  if (!res.length) return newError({ code: "baseModel:remove:nothingRemoved" });

  return { ids: res.map((r) => r.id) };
};

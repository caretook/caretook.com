import type { AppointmentSeries, Tx } from "../../db";
import type { QuerySelectArgs } from "../base/queryHelpers";

import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { appointmentSeriesSchema } from "../../db/schema";
import { softDeleteFunctions } from "../base/softDeleteModel";

export type { IncludeDeleted } from "../base/softDeleteModel";

export const schemaName = "appointmentSeriesSchema";
type K = typeof schemaName;

export const dbToModel = (row: AppointmentSeries) => row;

/** Storage order (the first day, then id). */
export const DEFAULT_ORDER = [
  { field: "startsOn", direction: "asc" },
  { field: "id", direction: "asc" },
] as const satisfies QuerySelectArgs<K>["orderBy"];

// Soft-deleted series are hidden unless a read asks for them, and can't be
// edited; `remove` sets `deletedAt`. Writes go through
// appointmentSeriesService, which validates the rule and the template, checks
// the providers and writes the visits.
export const { get, getById, list, create, update, remove } = softDeleteFunctions({
  schemaName,
  dbToModel,
  defaultOrder: DEFAULT_ORDER,
});

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

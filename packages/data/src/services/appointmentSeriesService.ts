import type { z } from "zod";
import type {
  AppointmentSeries,
  AppointmentSeriesCreateInput,
  AppointmentSeriesUpdateInput,
  AppointmentSeriesUpsertInput,
  TimelineEntryCreateInput,
  Tx,
} from "../db";
import type { SeriesVisit } from "../domain/appointments/seriesVisits";
import type { IncludeDeleted } from "../models/appointmentSeries";
import type { ServiceContext } from "./types";

import { SYSTEM_USER, isWriterRole } from "../constants";
import { withTransaction } from "../db";
import {
  addDays,
  appointmentSeriesContentOf,
  appointmentSeriesContentZSchema,
  appointmentSeriesCreateZSchema,
  appointmentSeriesUpdateZSchema,
  appointmentSeriesUpsertZSchema,
  dayInZone,
  SERIES_AHEAD_DAYS,
  seriesVisitFallbackId,
  seriesVisitId,
} from "../db/schema";
import { firstDayFrom, seriesVisits } from "../domain/appointments/seriesVisits";
import { isError, newError } from "../errors";
import { logError } from "../logging";
import {
  appointmentSeriesModel,
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  providerModel,
  timelineEntryModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";
import * as entryProviderService from "./entryProviderService";
import * as noteDocumentService from "./noteDocumentService";
import * as timelineEntryService from "./timelineEntryService";

// Repeating appointments and reminders (appointments-2). Write through here,
// not the model: this is where the rule and template are validated, the
// providers and recipient checked in the group, and the visits written.
//
// Each visit is an ordinary timeline entry, written through
// timelineEntryService in the series' transaction, with its provider links
// and an empty live document. Visit ids are `seriesVisitId(series, day)`,
// so the device that made the series and the server converge on one row;
// when another group's row holds that id, `seriesVisitFallbackId` (B-289).
//
// A device writes the series and its visits through `topped_up_through`
// itself (lib/appointments/series.sync.ts) and uploads them as ordinary ops,
// so a series that arrives with `toppedUpThrough` gets no visits here: its
// own visit uploads follow. One without it (an API caller, a seed) gets its
// visits from today (or its first day) through today + 90.

export const serviceName = "appointmentSeries";
export const schemaName = appointmentSeriesModel.schemaName;

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

const invalid = (error: z.ZodError) =>
  newError({ code: "appointmentSeriesService:invalid", meta: { issues: issuesOf(error) } });

const notFound = () => newError({ code: "appointmentSeriesService:notFound" });
const immutable = () => newError({ code: "appointmentSeriesService:immutable" });

/** The actor's role in the group, or null. The system acts as an owner. */
const roleIn = async (ctx: ServiceContext, tx: Tx, groupId: string) => {
  if (isSystemUser(ctx.authUser)) return "owner" as const;
  if (!ctx.authUser) return null;
  return careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
};

/**
 * The recipient a series is for: `recipientId` when given (it must be in the
 * group), else the group's only recipient. Reads are scoped to the actor.
 */
const resolveRecipient = async (ctx: ServiceContext, tx: Tx, groupId: string, recipientId?: string) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId)
      return newError({ code: "appointmentSeriesService:recipientNotInGroup" });
    return recipient;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  return recipient ?? newError({ code: "appointmentSeriesService:noRecipient" });
};

/** Each provider must be in the group and not deleted. Checked on create, and on update when the list changes. */
const checkProviders = async (ctx: ServiceContext, tx: Tx, groupId: string, ids: readonly string[]) => {
  for (const id of ids) {
    const provider = await providerModel.getById(id, { ...ctx, tx });
    if (isError(provider)) return provider;
    if (provider?.groupId !== groupId)
      return newError({
        code: "appointmentSeriesService:providerNotInGroup",
        meta: { issues: [{ path: "providerIds", message: "Choose providers in this care group" }] },
      });
  }
  return null;
};

/**
 * The visits to write, each with its id, leaving out days that have one
 * already (live or deleted): a row of this group and series for that day,
 * or its id held by one. When another row holds the computed id (another
 * group's, or not this series': B-289), the visit takes
 * `seriesVisitFallbackId`. Two reads for all the days (B-755).
 */
const visitSlots = async (tx: Tx, series: AppointmentSeries, visits: readonly SeriesVisit[]) => {
  if (!visits.length) return [];
  const sameDay = await timelineEntryModel.list({
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
    filter: {
      groupId: { type: "eq", value: series.groupId },
      seriesId: { type: "eq", value: series.id },
      seriesDay: { type: "inArray", value: visits.map((v) => v.day) },
    },
  });
  if (isError(sameDay)) return sameDay;
  const done = new Set(sameDay.data.map((row) => row.seriesDay));
  const open = visits.filter((visit) => !done.has(visit.day));
  if (!open.length) return [];

  const ids = open.map((visit) => seriesVisitId(series.id, visit.day));
  const sameId = await timelineEntryModel.list({
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
    filter: { id: { type: "inArray", value: ids } },
  });
  if (isError(sameId)) return sameId;
  const holders = new Map(sameId.data.map((row) => [row.id, row]));
  return open.flatMap((visit, i) => {
    const id = ids[i]!;
    const holder = holders.get(id);
    if (!holder) return [{ id, visit }];
    // This series' own row under the id (its day changed since): the day is taken care of.
    if (holder.groupId === series.groupId && holder.seriesId === series.id) return [];
    return [{ id: seriesVisitFallbackId(series.id, visit.day), visit }];
  });
};

/**
 * The series' providers a new visit links: all but the soft-deleted ones,
 * since a provider deleted after the series was made would otherwise refuse
 * every later visit (B-310). An unknown id stays, so its link still fails.
 */
const linkableProviders = async (tx: Tx, series: AppointmentSeries) => {
  const ids: string[] = [];
  for (const id of series.providerIds) {
    const provider = await providerModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(provider)) return provider;
    if (provider?.deletedAt) continue;
    ids.push(id);
  }
  return ids;
};

/**
 * Write the series' visits from `from` through `to` (local days), as the
 * actor, skipping days that already have one: an ordinary note or event
 * from the template, its provider links (deleted providers left out) and an
 * empty live document. Each table's rows go in one statement, entries, then
 * documents, then links, through their services' checks (B-755). Returns
 * the ids written.
 */
const writeVisits = async (
  ctx: ServiceContext,
  tx: Tx,
  series: AppointmentSeries,
  from: string,
  to: string,
) => {
  const event = series.kind === "event";
  const providerIds = await linkableProviders(tx, series);
  if (isError(providerIds)) return providerIds;
  const slots = await visitSlots(tx, series, seriesVisits(series, from, to));
  if (isError(slots)) return slots;
  if (!slots.length) return [];

  const entries = await timelineEntryService.createMany(
    { ...ctx, tx },
    slots.map(
      ({ id, visit }) =>
        ({
          id,
          groupId: series.groupId,
          recipientId: series.recipientId,
          kind: series.kind,
          title: series.title,
          occurredAt: visit.start,
          timeZone: series.timeZone,
          details: null,
          allDay: series.allDay,
          ...(event && { endsAt: visit.end, place: series.place }),
          seriesId: series.id,
          seriesDay: visit.day,
          // The schema checks the kind's rules (an event's title, a note's lack of place).
        }) as TimelineEntryCreateInput,
    ),
  );
  if (isError(entries)) return entries;
  const ids = slots.map((slot) => slot.id);
  const documents = await noteDocumentService.createForEntries(
    { ...ctx, tx },
    { groupId: series.groupId, ids },
  );
  if (isError(documents)) return documents;
  const links = await entryProviderService.linkMany(
    { ...ctx, tx },
    { groupId: series.groupId, entryIds: ids, providerIds },
  );
  if (isError(links)) return links;
  return ids;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One series, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  appointmentSeriesModel.getById(id, { ...ctx, ...opts });

/** A group's series, by first day. */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  appointmentSeriesModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type SeriesWriteOptions = {
  /** The clock (tests): where "today" is for the visits written. */
  now?: Date;
};

/**
 * Start a series. Writers only. Its providers and recipient must be in the
 * group. Without `toppedUpThrough` the visits are written here, from today
 * (or the first day, if later) through today + 90; with it, the device that
 * made the series already holds them and uploads them next.
 */
export const create = (
  ctx: ServiceContext,
  input: AppointmentSeriesCreateInput,
  opts: SeriesWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = appointmentSeriesCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const role = await roleIn(ctx, tx, data.groupId);
    if (isError(role)) return role;
    if (!isWriterRole(role)) return rejectError(ctx.authUser);

    const providers = await checkProviders(ctx, tx, data.groupId, data.providerIds);
    if (providers) return providers;

    const today = dayInZone(opts.now ?? new Date(), data.timeZone);
    const through = data.toppedUpThrough ?? addDays(today, SERIES_AHEAD_DAYS);
    const created = await appointmentSeriesModel.create({
      ...ctx,
      tx,
      data: { ...data, recipientId: recipient.id, toppedUpThrough: through },
    });
    if (isError(created)) return created;
    if (!created) return rejectError(ctx.authUser);

    if (!data.toppedUpThrough) {
      const from = data.startsOn > today ? data.startsOn : today;
      const visits = await writeVisits(ctx, tx, created, from, through);
      if (isError(visits)) return visits;
    }
    return created;
  }, ctx);

/**
 * Edit a series' rule or template. The group, recipient and kind are fixed;
 * the merged series must be valid; a changed provider list is checked in the
 * group. Visits aren't touched: an edit's plan writes them (slice 2).
 */
export const update = (ctx: ServiceContext, id: string, input: AppointmentSeriesUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = appointmentSeriesUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await appointmentSeriesModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = appointmentSeriesContentZSchema.safeParse({
      ...appointmentSeriesContentOf(existing),
      ...patch,
    });
    if (!merged.success) return invalid(merged.error);
    const { kind: _kind, toppedUpThrough: _through, ...content } = merged.data;

    if (JSON.stringify(content.providerIds) !== JSON.stringify(existing.providerIds)) {
      const added = content.providerIds.filter((p) => !existing.providerIds.includes(p));
      const providers = await checkProviders(ctx, tx, existing.groupId, added);
      if (providers) return providers;
    }

    const updated = await appointmentSeriesModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: content,
    });
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);

/**
 * Create the series with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. A replay changes nothing (only a
 * PATCH edits), whatever the actor's role now, so it never reverts a newer
 * edit. The group, recipient and kind never change, and an id the actor can't see is refused
 * without saying whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (
  ctx: ServiceContext,
  input: AppointmentSeriesUpsertInput,
  opts: SeriesWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = appointmentSeriesUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, kind } = parsed.data;

    const existing = await appointmentSeriesModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return asCreated(await create({ ...ctx, tx }, input, opts));

    const visible = await appointmentSeriesModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);

    if (
      visible.groupId !== groupId ||
      visible.kind !== kind ||
      (recipientId !== undefined && visible.recipientId !== recipientId)
    )
      return immutable();
    return unchanged(visible);
  }, ctx);

/**
 * Soft delete. The series stops; its visits are left as they are (deleting
 * "this and later" deletes them through the entry service: slice 2).
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await appointmentSeriesModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return notFound();
    return res;
  }, ctx);

// ---------------------------------------------------------------------------
// The daily top-up (the calendar cron's first step)
// ---------------------------------------------------------------------------

export type TopUpResult = {
  /** Series looked at (live, topped up through before their zone's today + 90, a visit still to come). */
  checked: number;
  /** Series whose `topped_up_through` moved forward. */
  toppedUp: number;
  /** Visits written. */
  visits: number;
  /** Series that failed (logged; the rest went on). */
  failed: number;
};

/** The most series one run covers: the rest wait for the next minute. */
export const TOP_UP_BATCH = 50;

/** Series read per page; a shorter page is the last. */
const TOP_UP_PAGE = 100;

/**
 * Keep every live series' visits 90 days ahead, as the system. For each
 * series whose `topped_up_through` is before today (in its own zone) + 90,
 * write the days after it through that date, skipping any day with a visit
 * already (live or deleted, by `(series_id, series_day)` in its group, since
 * a series' first visit keeps the draft's own id, or this series' row under
 * the computed id; an id another row holds gets the fallback id), then advance
 * `topped_up_through`. One transaction per series, so a failure leaves that
 * series as it was; a second run writes nothing. A series stops at its
 * UNTIL or COUNT (the expansion has no later days): once it has no visit
 * left to write it isn't touched again, so its row doesn't re-sync to every
 * device each day. A deleted one is left alone. Writing starts after
 * `topped_up_through` and no earlier than today (in the series' zone), so a
 * gap never invents past visits. A run does at most `limit` series (default
 * 50) and goes past failing ones.
 *
 * Only due series are read (B-311): zones are within -12/+14 h of UTC, so
 * each one's today + 90 is the UTC day + 89, 90 or 91. A series topped up
 * through before the UTC day + 89 is due anywhere; one in the band up to
 * the UTC day + 91 is due when its zone's edge is past it, so the zones in
 * that band are read first and each one's edge put in the query.
 */
export const topUp = async (
  now: Date = new Date(),
  opts: { limit?: number } = {},
): Promise<TopUpResult | ReturnType<typeof newError>> => {
  const ctx: ServiceContext = { authUser: SYSTEM_USER };
  const utcDay = now.toISOString().slice(0, 10);
  const earliest = addDays(utcDay, SERIES_AHEAD_DAYS - 1);
  const zones = await appointmentSeriesModel.topUpZones(earliest, addDays(utcDay, SERIES_AHEAD_DAYS + 1));
  if (isError(zones)) return zones;
  const byEdge = new Map<string, string[]>();
  for (const { timeZone } of zones) {
    const edge = addDays(dayInZone(now, timeZone), SERIES_AHEAD_DAYS);
    if (edge > earliest) byEdge.set(edge, [...(byEdge.get(edge) ?? []), timeZone]);
  }
  const edges = [...byEdge].map(([before, zones]) => ({ before, zones }));
  const limit = opts.limit ?? TOP_UP_BATCH;

  // Pages go by (edge, id) after the last one read, oldest edge first, so a
  // series that keeps failing can't starve the rest (the run goes past it)
  // and the series this run tops up leaving the set moves no page.
  const result: TopUpResult = { checked: 0, toppedUp: 0, visits: 0, failed: 0 };
  let after: appointmentSeriesModel.TopUpCursor | undefined;
  for (let page = 1; page <= 100 && result.toppedUp < limit; page++) {
    const rows = await appointmentSeriesModel.listDueForTopUp({
      before: earliest,
      edges,
      from: addDays(utcDay, -1),
      after,
      limit: TOP_UP_PAGE,
    });
    if (isError(rows)) return rows;

    for (const series of rows) {
      if (result.toppedUp >= limit) break;
      const today = dayInZone(now, series.timeZone);
      const through = addDays(today, SERIES_AHEAD_DAYS);
      // Never invent past visits after a gap: start no earlier than today.
      const next = series.toppedUpThrough ? addDays(series.toppedUpThrough, 1) : series.startsOn;
      const from = next > today ? next : today;
      // Ended (or unreadable): nothing left to write, so the row stays as it is.
      if (!firstDayFrom(series, from)) continue;
      result.checked++;

      const done = await withTransaction(async (tx) => {
        const written = await writeVisits(ctx, tx, series, from, through);
        if (isError(written)) return written;
        const updated = await appointmentSeriesModel.update({
          ...ctx,
          tx,
          filter: { id: { type: "eq", value: series.id } },
          data: { toppedUpThrough: through },
        });
        if (isError(updated)) return updated;
        return written.length;
      }, ctx);

      if (isError(done)) {
        result.failed++;
        logError("appointments: series top-up failed", done);
        continue;
      }
      result.toppedUp++;
      result.visits += done;
    }

    const last = rows.at(-1);
    if (rows.length < TOP_UP_PAGE || !last?.toppedUpThrough) break;
    after = { toppedUpThrough: last.toppedUpThrough, id: last.id };
  }
  return result;
};

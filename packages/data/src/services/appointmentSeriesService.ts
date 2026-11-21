import type { z } from "zod";
import type {
  AppointmentSeries,
  AppointmentSeriesCreateInput,
  AppointmentSeriesUpdateInput,
  AppointmentSeriesUpsertInput,
  TimelineEntryCreateInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/appointmentSeries";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
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
  seriesVisitId,
} from "../db/schema";
import { seriesVisits } from "../db/schema/appointments/seriesVisits";
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
// so the device that made the series and the server converge on one row.
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

/** Whether a visit for `day` (live or deleted) or its id exists already: then the day is left alone. */
const visitExists = async (tx: Tx, series: AppointmentSeries, day: string) => {
  const sameDay = await timelineEntryModel.get({
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
    filter: { seriesId: { type: "eq", value: series.id }, seriesDay: { type: "eq", value: day } },
  });
  if (isError(sameDay) || sameDay) return sameDay ? true : sameDay;
  const sameId = await timelineEntryModel.getById(seriesVisitId(series.id, day), {
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
  });
  return isError(sameId) ? sameId : !!sameId;
};

/**
 * Write the series' visits from `from` through `to` (local days), as the
 * actor, skipping days that already have one: an ordinary note or event
 * from the template, its provider links and an empty live document.
 * Returns the ids written.
 */
const writeVisits = async (
  ctx: ServiceContext,
  tx: Tx,
  series: AppointmentSeries,
  from: string,
  to: string,
) => {
  const written: string[] = [];
  const event = series.kind === "event";
  for (const visit of seriesVisits(series, from, to)) {
    const exists = await visitExists(tx, series, visit.day);
    if (isError(exists)) return exists;
    if (exists) continue;
    const id = seriesVisitId(series.id, visit.day);
    const entry = await timelineEntryService.create({ ...ctx, tx }, {
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
    } as TimelineEntryCreateInput);
    if (isError(entry)) return entry;
    const document = await noteDocumentService.create({ ...ctx, tx }, { id, groupId: series.groupId });
    if (isError(document)) return document;
    for (const providerId of series.providerIds) {
      const link = await entryProviderService.link(
        { ...ctx, tx },
        { groupId: series.groupId, entryId: id, providerId },
      );
      if (isError(link)) return link;
    }
    written.push(id);
  }
  return written;
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
    if (!role || role === "viewer") return rejectError(ctx.authUser);

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
 * Create the series with this id, or bring the existing one up to date:
 * PowerSync's upload of a series a device made. Safe to replay.
 *
 * - A new id is a `create` (same checks).
 * - An existing id is an `update`; its group, recipient and kind must match.
 * - A deleted series stays deleted.
 * - An id the actor can't see is refused, without saying whether it exists.
 */
export const upsert = (
  ctx: ServiceContext,
  input: AppointmentSeriesUpsertInput,
  opts: SeriesWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = appointmentSeriesUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, kind, toppedUpThrough: _through, ...content } = parsed.data;

    const existing = await appointmentSeriesModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, input, opts);

    const visible = await appointmentSeriesModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);

    if (
      visible.groupId !== groupId ||
      visible.kind !== kind ||
      (recipientId !== undefined && visible.recipientId !== recipientId)
    )
      return immutable();
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, content);
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
  /** Series looked at (live, topped up through before their zone's today + 90). */
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

/**
 * Keep every live series' visits 90 days ahead, as the system. For each
 * series whose `topped_up_through` is before today (in its own zone) + 90,
 * write the days after it through that date, skipping any day with a visit
 * already (live or deleted, by `(series_id, series_day)` or by id, since a
 * series' first visit keeps the draft's own id), then advance
 * `topped_up_through`. One transaction per series, so a failure leaves that
 * series as it was; a second run writes nothing. A series stops at its
 * UNTIL or COUNT (the expansion has no later days) and a deleted one is
 * left alone. A series that has never been topped up starts from its first
 * day or today, whichever is later.
 */
export const topUp = async (
  now: Date = new Date(),
  opts: { limit?: number } = {},
): Promise<TopUpResult | ReturnType<typeof newError>> => {
  const ctx: ServiceContext = { authUser: SYSTEM_USER };
  // Zones are within +/-14 h of UTC, so a series that's due has a
  // `topped_up_through` before the UTC day + 91; each is then checked in its own zone.
  const horizon = addDays(now.toISOString().slice(0, 10), SERIES_AHEAD_DAYS + 1);
  const candidates = await appointmentSeriesModel.list({
    ...ctx,
    filter: { toppedUpThrough: { type: "lte", value: horizon } },
    orderBy: [
      { field: "toppedUpThrough", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    paginate: { limit: Math.min(opts.limit ?? TOP_UP_BATCH, 100), page: 1 },
  });
  if (isError(candidates)) return candidates;

  const result: TopUpResult = { checked: 0, toppedUp: 0, visits: 0, failed: 0 };
  for (const series of candidates.data) {
    const today = dayInZone(now, series.timeZone);
    const through = addDays(today, SERIES_AHEAD_DAYS);
    if (series.toppedUpThrough && series.toppedUpThrough >= through) continue;
    result.checked++;

    const done = await withTransaction(async (tx) => {
      const from = series.toppedUpThrough
        ? addDays(series.toppedUpThrough, 1)
        : series.startsOn > today
          ? series.startsOn
          : today;
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
  return result;
};

import type { z } from "zod";
import type {
  TimelineEntry,
  TimelineEntryCreateInput,
  TimelineEntryKind,
  TimelineEntryUpdateInput,
  TimelineEntryUpsertInput,
  Tx,
} from "../db";
import type { Filter } from "../models";
import type { IncludeDeleted } from "../models/timelineEntry";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  canHaveNoteDocument,
  FUTURE_DATE_MESSAGE,
  isDoseDetails,
  isTooFarAhead,
  SERVER_FUTURE_SKEW_MS,
  isSystemWrittenKind,
  timelineEntryContentZSchema,
  timelineEntryCreateZSchema,
  timelineEntryUpdateZSchema,
  timelineEntryUpsertZSchema,
} from "../db/schema";
import { isPastVisit } from "../db/schema/appointments/seriesEdit";
import { isError, newError } from "../errors";
import {
  appointmentSeriesModel,
  careGroupModel,
  careRecipientModel,
  medicationModel,
  noteDocumentModel,
  timelineEntryModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";
import { enqueue as enqueueCalendarPush } from "./calendarSyncService";
import { releaseEvent } from "./todoService";
export const serviceName = "timelineEntry";
export const schemaName = timelineEntryModel.schemaName;

type K = typeof schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "timelineEntryService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "timelineEntryService:notFound" });

/**
 * Medication changes are written by `medicationService`, with the
 * medication: nobody creates or edits one by hand. (Deleting one is fine.)
 */
const refuseSystemWritten = (ctx: ServiceContext, kind: string) =>
  isSystemWrittenKind(kind) && !isSystemUser(ctx.authUser)
    ? newError({ code: "timelineEntryService:systemWrittenKind" })
    : null;

/**
 * A dose's medication must be in the entry's group, as the actor sees it. A
 * deleted medication still counts: its doses stay, and a replayed upload of
 * one must still land.
 */
const checkDoseMedication = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  details: TimelineEntry["details"] | undefined,
) => {
  if (!isDoseDetails(details)) return null;
  const medication = await medicationModel.getById(details.medicationId, {
    ...ctx,
    tx,
    includeDeleted: true,
  });
  if (isError(medication)) return medication;
  return medication?.groupId === groupId
    ? null
    : newError({
        code: "timelineEntryService:medicationNotInGroup",
        meta: {
          issues: [{ path: "details.medicationId", message: "Choose a medication in this care group" }],
        },
      });
};

/** Postgres timestamptz text → ISO 8601, so stored rows re-validate. */
const toIso = (value: string) => new Date(value).toISOString();
const toIsoOrNull = (value: string | null | undefined) => (value ? toIso(value) : null);

/**
 * Only events may be dated in the future. The server allows an
 * hour of clock skew (a device allows five minutes): a refused upload is
 * dropped, so a device whose clock runs fast must not lose a real vital.
 */
const refuseFuture = (kind: string, occurredAt: string) =>
  isTooFarAhead(kind, occurredAt, new Date(), SERVER_FUTURE_SKEW_MS)
    ? newError({
        code: "timelineEntryService:invalid",
        meta: { issues: [{ path: "occurredAt", message: FUTURE_DATE_MESSAGE }] },
      })
    : null;

/**
 * A cancelled event's replacement: another event in the same group, as the
 * actor sees it. A deleted one still counts, so a replayed upload lands.
 */
const checkRescheduledTo = async (
  ctx: ServiceContext,
  tx: Tx,
  { id, groupId, rescheduledTo }: { id?: string; groupId: string; rescheduledTo?: string | null },
) => {
  if (!rescheduledTo) return null;
  const refused = newError({
    code: "timelineEntryService:rescheduledToNotInGroup",
    meta: { issues: [{ path: "rescheduledTo", message: "Choose another event in this care group" }] },
  });
  if (rescheduledTo === id) return refused;
  const target = await timelineEntryModel.getById(rescheduledTo, { ...ctx, tx, includeDeleted: true });
  if (isError(target)) return target;
  return target?.groupId === groupId && target.kind === "event" ? null : refused;
};

/**
 * A visit's series: one of the entry's kind in the same group, as the actor
 * sees it (a deleted one still counts, so a replayed upload lands), with no
 * other live visit on the same day.
 */
const checkSeries = async (
  ctx: ServiceContext,
  tx: Tx,
  {
    id,
    groupId,
    kind,
    seriesId,
    seriesDay,
  }: { id?: string; groupId: string; kind: string; seriesId?: string | null; seriesDay?: string | null },
) => {
  if (!seriesId) return null;
  const series = await appointmentSeriesModel.getById(seriesId, { ...ctx, tx, includeDeleted: true });
  if (isError(series)) return series;
  if (series?.groupId !== groupId || series.kind !== kind)
    return newError({
      code: "timelineEntryService:seriesNotInGroup",
      meta: { issues: [{ path: "seriesId", message: "Choose a series in this care group" }] },
    });
  if (!seriesDay) return null;
  const taken = await timelineEntryModel.get({
    authUser: SYSTEM_USER,
    tx,
    filter: {
      seriesId: { type: "eq", value: seriesId },
      seriesDay: { type: "eq", value: seriesDay },
      ...(id ? { id: { type: "ne", value: id } } : {}),
    },
  });
  if (isError(taken)) return taken;
  return taken
    ? newError({
        code: "timelineEntryService:seriesDayTaken",
        meta: { issues: [{ path: "seriesDay", message: "This series already has a visit that day" }] },
      })
    : null;
};

/**
 * Who cancelled an event is the server's to say, like the audit columns: the
 * actor who set `cancelledAt`, kept while it stays cancelled, cleared on undo.
 */
const cancelledByFor = (
  ctx: ServiceContext,
  before: Pick<TimelineEntry, "cancelledAt" | "cancelledBy"> | null,
  cancelledAt: string | null | undefined,
) => {
  if (!cancelledAt) return null;
  if (before?.cancelledAt && before.cancelledBy) return before.cancelledBy;
  return ctx.authUser?.id ?? null;
};

/** The appointment columns of validated content, with nulls for what's unset. */
const schedulingColumns = (content: {
  allDay?: boolean;
  endsAt?: string | null;
  place?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  rescheduledTo?: string | null;
  seriesId?: string | null;
  seriesDay?: string | null;
  seriesDetached?: boolean;
}) => ({
  allDay: content.allDay ?? false,
  endsAt: content.endsAt ?? null,
  place: content.place ?? null,
  cancelledAt: content.cancelledAt ?? null,
  cancelReason: content.cancelReason ?? null,
  rescheduledTo: content.rescheduledTo ?? null,
  seriesId: content.seriesId ?? null,
  seriesDay: content.seriesDay ?? null,
  seriesDetached: content.seriesDetached ?? false,
});

/**
 * The recipient an entry is about: `recipientId` when given (it must be in
 * the group), else the group's only recipient. Reads are scoped to the
 * actor, so a non-member learns nothing about the group.
 */
const resolveRecipient = async (ctx: ServiceContext, tx: Tx, groupId: string, recipientId?: string) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId) return newError({ code: "timelineEntryService:recipientNotInGroup" });
    return recipient.id;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  if (!recipient) return newError({ code: "timelineEntryService:noRecipient" });
  return recipient.id;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * A note's or event's text is its live document, so its stored `body` is
 * null. Reads fill `body` from the document's compacted text, so API, AI
 * and worker callers keep one text field. Pending (uncompacted) updates
 * aren't included; `noteDocumentService.currentText` has those.
 *
 * - No document yet (its upload is still pending), or an empty one: the
 *   stored body (null for notes).
 * - A soft-deleted entry never gets its document's text.
 * - Documents are read in the actor's scope, like the entries.
 */
export const withDocumentText = async <T extends TimelineEntry>(ctx: ServiceContext, entries: T[]) => {
  const ids = new Set(entries.filter((e) => canHaveNoteDocument(e.kind) && !e.deletedAt).map((e) => e.id));
  if (!ids.size) return entries;

  const docs = await noteDocumentModel.list({ ...ctx, filter: { id: { type: "inArray", value: [...ids] } } });
  if (isError(docs)) return docs;
  const text = new Map(docs.data.map((d) => [d.id, d.text]));

  return entries.map((entry) => {
    const docText = ids.has(entry.id) ? text.get(entry.id) : undefined;
    return docText ? { ...entry, body: docText } : entry;
  });
};

const withDocumentTextOne = async <T extends TimelineEntry>(ctx: ServiceContext, entry: T | null) => {
  if (!entry) return entry;
  const res = await withDocumentText(ctx, [entry]);
  return isError(res) ? res : (res[0] ?? null);
};

/** One entry, with a note's or event's `body` from its document (see `withDocumentText`). */
export const getById = async (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) => {
  const entry = await timelineEntryModel.getById(id, { ...ctx, ...opts });
  return isError(entry) ? entry : withDocumentTextOne(ctx, entry);
};

export type TimelineListOptions = IncludeDeleted & {
  groupId: string;
  kinds?: TimelineEntryKind[];
  /** Inclusive lower bound on occurredAt (ISO 8601). */
  from?: string;
  /** Exclusive upper bound on occurredAt (ISO 8601). */
  to?: string;
  /** Only entries this member wrote (`created_by`). */
  authorId?: string;
  cursor?: string | null;
  limit?: number;
};

/**
 * One group's timeline, newest first, with notes' and events' `body` from
 * their documents (see `withDocumentText`). Pass `nextCursor` back for the
 * next page.
 */
export const list = async (
  ctx: ServiceContext,
  { groupId, kinds, from, to, authorId, ...opts }: TimelineListOptions,
) => {
  const range = [
    ...(from ? [{ type: "gte" as const, value: from }] : []),
    ...(to ? [{ type: "lt" as const, value: to }] : []),
  ];
  const filter: Filter<K> = {
    groupId: { type: "eq", value: groupId },
    ...(kinds?.length ? { kind: { type: "inArray", value: kinds } } : {}),
    ...(authorId ? { createdBy: { type: "eq", value: authorId } } : {}),
    ...(range.length ? { occurredAt: { type: "and", value: range } } : {}),
  };
  const page = await timelineEntryModel.listPage({ ...ctx, ...opts, filter });
  if (isError(page)) return page;
  const data = await withDocumentText(ctx, page.data);
  return isError(data) ? data : { ...page, data };
};

/** The newest reading of each vital type in a group, with the entry it came from. */
export const latestVitals = (ctx: ServiceContext, { groupId }: { groupId: string }) =>
  timelineEntryModel.latestReadings({ ...ctx, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Server-only write options, never from a device: `via` is the assistant an
 * entry was written through ("Claude"; connectors PRD), set only by
 * `assistantActionService.run`.
 */
export type EntryWriteOptions = { via?: string | null };

/** Add an entry. Content is validated per kind; `id` may come from an offline client. */
export const create = (ctx: ServiceContext, input: TimelineEntryCreateInput, opts: EntryWriteOptions = {}) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, details, ...data } = parsed.data;

    const refused = refuseSystemWritten(ctx, data.kind);
    if (refused) return refused;

    const resolved = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(resolved)) return resolved;

    const future = refuseFuture(data.kind, data.occurredAt);
    if (future) return future;

    const medication = await checkDoseMedication(ctx, tx, data.groupId, details);
    if (medication) return medication;

    const moved = await checkRescheduledTo(ctx, tx, data);
    if (moved) return moved;

    const series = await checkSeries(ctx, tx, data);
    if (series) return series;

    const created = await timelineEntryModel.create({
      ...ctx,
      tx,
      data: {
        ...data,
        ...schedulingColumns(data),
        cancelledBy: cancelledByFor(ctx, null, data.cancelledAt),
        recipientId: resolved,
        details: details ?? null,
        ...(opts.via ? { via: opts.via } : {}),
      },
    });
    if (isError(created) || !created) return created;
    // Appointments and reminders reach members' Google calendars (appointments-2).
    const queued = await enqueueCalendarPush(tx, { entryId: created.id }, "entry");
    return queued ?? created;
  }, ctx);

/**
 * Edit an entry's content. Group, recipient and kind are fixed. The merged
 * entry must still be valid for its kind (a note can't lose its body).
 */
export const update = (
  ctx: ServiceContext,
  id: string,
  input: TimelineEntryUpdateInput,
  opts: { now?: Date } = {},
) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await timelineEntryModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const refused = refuseSystemWritten(ctx, existing.kind);
    if (refused) return refused;

    const merged = timelineEntryContentZSchema.safeParse({
      kind: existing.kind,
      title: existing.title,
      body: existing.body,
      occurredAt: toIso(existing.occurredAt),
      timeZone: existing.timeZone,
      details: existing.details,
      allDay: existing.allDay,
      endsAt: toIsoOrNull(existing.endsAt),
      place: existing.place,
      cancelledAt: toIsoOrNull(existing.cancelledAt),
      cancelReason: existing.cancelReason,
      rescheduledTo: existing.rescheduledTo,
      seriesId: existing.seriesId,
      seriesDay: existing.seriesDay,
      seriesDetached: existing.seriesDetached,
      ...patch,
    });
    if (!merged.success) return invalid(merged.error);
    const { kind: _kind, ...content } = merged.data;

    // Checked only when the time moves, so an entry stored before the rule
    // (or by a fast clock, within the skew) can still be edited.
    if (new Date(content.occurredAt).getTime() !== new Date(existing.occurredAt).getTime()) {
      const future = refuseFuture(existing.kind, content.occurredAt);
      if (future) return future;
    }

    const medication = await checkDoseMedication(ctx, tx, existing.groupId, content.details);
    if (medication) return medication;

    if ((content.rescheduledTo ?? null) !== existing.rescheduledTo) {
      const moved = await checkRescheduledTo(ctx, tx, { ...content, id, groupId: existing.groupId });
      if (moved) return moved;
    }

    if (
      (content.seriesId ?? null) !== existing.seriesId ||
      (content.seriesDay ?? null) !== existing.seriesDay
    ) {
      const series = await checkSeries(ctx, tx, {
        ...content,
        id,
        kind: existing.kind,
        groupId: existing.groupId,
      });
      if (series) return series;
    }

    // A series edit ("This and later") moves visits onto the new series; it
    // never rewrites one that has already started.
    if (
      existing.seriesId &&
      content.seriesId &&
      content.seriesId !== existing.seriesId &&
      isPastVisit(
        { occurredAt: toIso(existing.occurredAt), allDay: existing.allDay },
        existing.timeZone,
        opts.now ?? new Date(),
      )
    )
      return newError({
        code: "timelineEntryService:pastVisit",
        meta: { issues: [{ path: "seriesId", message: "A past visit stays as it was" }] },
      });

    const updated = await timelineEntryModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: {
        ...content,
        ...schedulingColumns(content),
        cancelledBy: cancelledByFor(ctx, existing, content.cancelledAt),
        details: content.details ?? null,
      },
    });
    if (isError(updated)) return updated;
    const queued = await enqueueCalendarPush(tx, { entryId: id }, "entry");
    return queued ?? updated[0] ?? null;
  }, ctx);

/**
 * Create the entry with this id, or bring the existing one up to date: what
 * PowerSync's upload queue sends for a row a device created. Safe to replay:
 * a second identical call changes nothing but `updatedAt`.
 *
 * - A new id is a `create` (same validation and group check).
 * - An existing id is an `update` of its content, by the same rules. Its
 *   group, recipient and kind must match: they never change.
 * - A deleted entry stays deleted (a delete wins over a late edit).
 * - An id that exists but the actor can't see is refused, without saying
 *   whether it exists.
 * - A medication change is never created or edited here: one that exists
 *   (written by `medicationService` with the medication) is left as it is,
 *   and one that doesn't is refused.
 */
export const upsert = (ctx: ServiceContext, input: TimelineEntryUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = timelineEntryUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, kind, title, body, occurredAt, timeZone, details } = parsed.data;
    // Appointment fields a device sent; ones it left out keep their value.
    const scheduling = Object.fromEntries(
      (
        [
          "allDay",
          "endsAt",
          "place",
          "cancelledAt",
          "cancelReason",
          "rescheduledTo",
          "seriesId",
          "seriesDay",
          "seriesDetached",
        ] as const
      )
        .filter((key) => key in parsed.data)
        .map((key) => [key, (parsed.data as Record<string, unknown>)[key]]),
    );

    // Existence is checked as the system, so a taken id is refused cleanly
    // rather than failing on the primary key.
    const existing = await timelineEntryModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, parsed.data);

    const visible = await timelineEntryModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);

    if (
      visible.groupId !== groupId ||
      visible.kind !== kind ||
      (recipientId !== undefined && visible.recipientId !== recipientId)
    )
      return newError({ code: "timelineEntryService:immutable" });
    if (visible.deletedAt) return visible;
    // A device's copy of a change entry the service already wrote with the
    // medication: the service's stands.
    if (isSystemWrittenKind(visible.kind)) return visible;

    return update(
      { ...ctx, tx },
      id,
      // Checked against the entry's kind once merged with the stored row.
      {
        title,
        body,
        occurredAt,
        timeZone,
        details: details ?? null,
        ...scheduling,
      } as TimelineEntryUpdateInput,
    );
  }, ctx);

/**
 * Soft delete. The entry disappears from the timeline but syncs as deleted.
 * Todos linked to a deleted event lose the link in the same transaction
 * (todos PRD), as the todo table's FK does on a hard delete.
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await timelineEntryModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return notFound();
    if (isError(res)) return res;
    const released = await releaseEvent(tx, id);
    if (isError(released)) return released;
    const queued = await enqueueCalendarPush(tx, { entryId: id }, "entry");
    return queued ?? res;
  }, ctx);

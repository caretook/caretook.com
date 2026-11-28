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

import { and, eq } from "drizzle-orm";
import { SYSTEM_USER, isOwnRowLogger } from "../constants";
import { dbMayFail, withTransaction } from "../db";
import {
  buildNoteDoc,
  canHaveNoteDocument,
  canLogEntry,
  doseDuplicateUploadSchema,
  FUTURE_DATE_MESSAGE,
  isDoseDetails,
  isSymptomDetails,
  isTooFarAhead,
  noteText,
  SERVER_FUTURE_SKEW_MS,
  isSystemWrittenKind,
  symptomTypeId,
  timelineEntryContentZSchema,
  timelineEntryCreateZSchema,
  timelineEntryUpdateZSchema,
  timelineEntryUpsertZSchema,
  userSchema,
} from "../db/schema";
import { isPastVisit } from "../db/schema/appointments/seriesEdit";
import { isError, newError } from "../errors";
import {
  appointmentSeriesModel,
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  medicationModel,
  noteDocumentModel,
  noteUpdateModel,
  timelineEntryModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";
import { enqueue as enqueueCalendarPush } from "./calendarSyncService";
import {
  ensure as ensureSymptomType,
  getById as getSymptomType,
  lockCatalog as lockSymptomCatalog,
} from "./symptomTypeService";
import { releaseEvent } from "./todoService";
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
 * An Easy helper logs care and nothing else (`canLogEntry`): the logged
 * kinds, never an appointment's series, reschedule or cancellation, and on
 * an update never clearing one a writer set (`existing`). (Which
 * rows they may edit or delete is the permission map's `groupOwn`, in SQL.)
 * Writers and the system pass; other roles are refused by the model.
 */
const refuseLoggerOnly = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  kind: string,
  data: Parameters<typeof canLogEntry>[2],
  existing?: Parameters<typeof canLogEntry>[3],
) => {
  if (!ctx.authUser || isSystemUser(ctx.authUser)) return null;
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  if (!isOwnRowLogger(role)) return null;
  return canLogEntry(role, kind, data, existing)
    ? null
    : newError({ code: "timelineEntryService:loggerOnly" });
};

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

/**
 * A symptom's catalog row (symptom-catalog), derived from `details.name` on
 * every write, whatever a device sent: the group's row for the name, added
 * (as the actor, a logger) when the group has none. A deleted name (a
 * tombstone) resolves to its replacement (symptom-catalog-3): its id, and
 * its name for `details.name`; otherwise the name stays as written. `current`
 * is the stored pointer: when it's already the derived one and that row isn't
 * a tombstone, it's kept and nothing is added. Holds the group's catalog lock
 * shared first (B-992), so a write read before a `replace` and landing after
 * it sees the tombstone the replace made and follows it, rather than putting
 * the old name and pointer back. Null for every other kind, which takes no
 * lock, and then `details` is as given.
 */
const symptomTypeFor = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  kind: string,
  details: TimelineEntry["details"] | undefined,
  current?: string | null,
) => {
  if (kind !== "symptom" || !isSymptomDetails(details)) return { id: null, details };
  const locked = await lockSymptomCatalog(tx, groupId, "shared");
  if (isError(locked)) return locked;
  const derived = symptomTypeId(groupId, details.name);
  if (current && current === derived) {
    const stored = await getSymptomType({ ...ctx, tx }, current);
    if (isError(stored)) return stored;
    if (stored && !stored.replacedById) return { id: current, details };
  }
  let row = await ensureSymptomType({ ...ctx, tx }, groupId, details.name);
  if (isError(row)) return row;
  if (!row) return rejectError(ctx.authUser);
  // Never a tombstone under the lock (a replace repoints older ones); followed if it is.
  if (row.replacedById) {
    const next = await getSymptomType({ ...ctx, tx }, row.replacedById);
    if (isError(next)) return next;
    if (next) row = next;
  }
  return { id: row.id, details: row.id === derived ? details : { ...details, name: row.name } };
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

const seriesNotInGroup = () =>
  newError({
    code: "timelineEntryService:seriesNotInGroup",
    meta: { issues: [{ path: "seriesId", message: "Choose a series in this care group" }] },
  });

const seriesDayTaken = () =>
  newError({
    code: "timelineEntryService:seriesDayTaken",
    meta: { issues: [{ path: "seriesDay", message: "This series already has a visit that day" }] },
  });

/** A visit's series: one of the entry's kind in the same group, as the actor sees it (a deleted one still counts). */
const checkSeriesOf = async (
  ctx: ServiceContext,
  tx: Tx,
  { groupId, kind, seriesId }: { groupId: string; kind: string; seriesId: string },
) => {
  const series = await appointmentSeriesModel.getById(seriesId, { ...ctx, tx, includeDeleted: true });
  if (isError(series)) return series;
  return series?.groupId !== groupId || series.kind !== kind ? seriesNotInGroup() : null;
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
  const series = await checkSeriesOf(ctx, tx, { groupId, kind, seriesId });
  if (series) return series;
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
  return taken ? seriesDayTaken() : null;
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
 * null. Reads fill `body` from the document's current text, so API, AI
 * and worker callers keep one text field. That includes updates not yet
 * compacted (B-312): compaction runs only inside an upload that adds an
 * update, so a short session's last updates can wait indefinitely. Merging
 * them here is read-only; the upload path still decides when to compact.
 *
 * - No document yet (its upload is still pending), or an empty one: the
 *   stored body (null for notes).
 * - A soft-deleted entry never gets its document's text.
 * - Documents and their updates are read in the actor's scope, like the entries.
 */
export const withDocumentText = async <T extends TimelineEntry>(ctx: ServiceContext, entries: T[]) => {
  const ids = new Set(entries.filter((e) => canHaveNoteDocument(e.kind) && !e.deletedAt).map((e) => e.id));
  if (!ids.size) return entries;

  const docs = await noteDocumentModel.list({ ...ctx, filter: { id: { type: "inArray", value: [...ids] } } });
  if (isError(docs)) return docs;
  if (!docs.data.length) return entries;
  const updates = await noteUpdateModel.list({
    ...ctx,
    filter: { documentId: { type: "inArray", value: docs.data.map((d) => d.id) } },
  });
  if (isError(updates)) return updates;
  const pending = new Map<string, string[]>();
  for (const u of updates.data) pending.set(u.documentId, [...(pending.get(u.documentId) ?? []), u.data]);

  const text = new Map(
    docs.data.map((d) => {
      const waiting = pending.get(d.id);
      if (!waiting) return [d.id, d.text];
      const ydoc = buildNoteDoc(d.snapshot, waiting);
      const current = noteText(ydoc);
      ydoc.destroy();
      return [d.id, current];
    }),
  );

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

/**
 * The group's medication change entries from `from` on, deleted ones too
 * (deleting the line doesn't undo the change), as `scheduleHistory` reads them.
 */
export const scheduleChanges = async (
  ctx: ServiceContext,
  { groupId, from }: { groupId: string; from: string },
) => {
  const changes: { id: string; occurredAt: string; details: unknown }[] = [];
  let cursor: string | null = null;
  do {
    const page = await timelineEntryModel.listPage({
      ...ctx,
      includeDeleted: true,
      filter: {
        groupId: { type: "eq", value: groupId },
        kind: { type: "eq", value: "medicationChange" },
        occurredAt: { type: "gte", value: from },
      },
      cursor,
      limit: 500,
    });
    if (isError(page)) return page;
    for (const { id, occurredAt, details } of page.data)
      changes.push({ id, occurredAt: new Date(occurredAt).toISOString(), details });
    cursor = page.nextCursor;
  } while (cursor);
  return changes;
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

    const loggerOnly = await refuseLoggerOnly(ctx, tx, data.groupId, data.kind, data);
    if (loggerOnly) return loggerOnly;

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

    const symptomType = await symptomTypeFor(ctx, tx, data.groupId, data.kind, details);
    if (isError(symptomType)) return symptomType;

    const created = await timelineEntryModel.create({
      ...ctx,
      tx,
      data: {
        ...data,
        ...schedulingColumns(data),
        cancelledBy: cancelledByFor(ctx, null, data.cancelledAt),
        recipientId: resolved,
        details: symptomType.details ?? null,
        symptomTypeId: symptomType.id,
        ...(opts.via ? { via: opts.via } : {}),
      },
    });
    if (isError(created) || !created) return created;
    // Appointments and reminders reach members' Google calendars (appointments-2).
    const queued = await enqueueCalendarPush(tx, { entryId: created.id }, "entry");
    return queued ?? created;
  }, ctx);

/** One promise per key: a read shared by many entries runs once. */
const once = <T>(read: (key: string) => Promise<T>) => {
  const seen = new Map<string, Promise<T>>();
  return (key: string) => {
    let value = seen.get(key);
    if (!value) seen.set(key, (value = read(key)));
    return value;
  };
};

/**
 * `create` for many entries in one INSERT (a series' visits: B-755). Each
 * entry gets create's checks, in create's order, with the reads they share
 * done once: the actor's role and the recipient per group, each series
 * once, and the series days taken in one read. Then one calendar push per
 * group with an event. All or nothing. Returns the entries in `inputs`' order.
 */
export const createMany = (
  ctx: ServiceContext,
  inputs: readonly TimelineEntryCreateInput[],
  opts: EntryWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const roleIn = once((groupId) => careGroupMemberModel.getRole(groupId, ctx.authUser?.id ?? "", { tx }));
    const recipientOf = once((key) => {
      const [groupId = "", recipientId] = key.split("|");
      return resolveRecipient(ctx, tx, groupId, recipientId || undefined);
    });
    const seriesOf = once((key) => {
      const [seriesId = "", groupId = "", kind = ""] = key.split("|");
      return checkSeriesOf(ctx, tx, { seriesId, groupId, kind });
    });

    const entries = [];
    for (const input of inputs) {
      const parsed = timelineEntryCreateZSchema.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      const { recipientId, details, ...data } = parsed.data;

      const refused = refuseSystemWritten(ctx, data.kind);
      if (refused) return refused;

      if (ctx.authUser && !isSystemUser(ctx.authUser)) {
        const role = await roleIn(data.groupId);
        if (isError(role)) return role;
        if (isOwnRowLogger(role) && !canLogEntry(role, data.kind, data))
          return newError({ code: "timelineEntryService:loggerOnly" });
      }

      const resolved = await recipientOf(`${data.groupId}|${recipientId ?? ""}`);
      if (isError(resolved)) return resolved;

      const future = refuseFuture(data.kind, data.occurredAt);
      if (future) return future;

      const medication = await checkDoseMedication(ctx, tx, data.groupId, details);
      if (medication) return medication;

      const moved = await checkRescheduledTo(ctx, tx, data);
      if (moved) return moved;

      if (data.seriesId) {
        const series = await seriesOf(`${data.seriesId}|${data.groupId}|${data.kind}`);
        if (series) return series;
      }

      const symptomType = await symptomTypeFor(ctx, tx, data.groupId, data.kind, details);
      if (isError(symptomType)) return symptomType;

      entries.push({
        ...data,
        ...schedulingColumns(data),
        cancelledBy: cancelledByFor(ctx, null, data.cancelledAt),
        recipientId: resolved,
        details: symptomType.details ?? null,
        symptomTypeId: symptomType.id,
        ...(opts.via ? { via: opts.via } : {}),
      });
    }

    // No other live visit on a series' day: one read for every visit, and
    // none twice in the batch.
    const visits = entries.filter((e) => e.seriesId && e.seriesDay);
    if (visits.length) {
      const live = await timelineEntryModel.list({
        authUser: SYSTEM_USER,
        tx,
        filter: {
          seriesId: { type: "inArray", value: [...new Set(visits.map((e) => e.seriesId!))] },
          seriesDay: { type: "inArray", value: [...new Set(visits.map((e) => e.seriesDay!))] },
        },
      });
      if (isError(live)) return live;
      const held = new Map(live.data.map((row) => [`${row.seriesId}|${row.seriesDay}`, row.id]));
      for (const entry of visits) {
        const key = `${entry.seriesId}|${entry.seriesDay}`;
        const holder = held.get(key);
        if (holder !== undefined && holder !== entry.id) return seriesDayTaken();
        held.set(key, entry.id ?? "");
      }
    }

    const created = await timelineEntryModel.createMany({ ...ctx, tx, data: entries });
    if (isError(created)) return created;
    // Appointments and reminders reach members' Google calendars (appointments-2):
    // the same job create queues, once per group.
    for (const groupId of new Set(created.filter((e) => e.kind === "event").map((e) => e.groupId))) {
      const queued = await enqueueCalendarPush(tx, { groupId }, "entry");
      if (queued) return queued;
    }
    return created;
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

    const loggerOnly = await refuseLoggerOnly(ctx, tx, existing.groupId, existing.kind, patch, existing);
    if (loggerOnly) return loggerOnly;
    // Seen but not theirs to change (a viewer; an Easy helper on another
    // member's entry): refused cleanly, before any write.
    const mayUpdate = await timelineEntryModel.mayChange(id, "update", { ...ctx, tx });
    if (isError(mayUpdate)) return mayUpdate;
    if (!mayUpdate) return rejectError(ctx.authUser);

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

    // A renamed symptom moves to its name's type (added when new); a stored
    // pointer that's missing or stale is put right on any edit.
    const symptomType = await symptomTypeFor(
      ctx,
      tx,
      existing.groupId,
      existing.kind,
      content.details,
      existing.symptomTypeId,
    );
    if (isError(symptomType)) return symptomType;

    const updated = await timelineEntryModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: {
        ...content,
        ...schedulingColumns(content),
        cancelledBy: cancelledByFor(ctx, existing, content.cancelledAt),
        details: symptomType.details ?? null,
        symptomTypeId: symptomType.id,
      },
    });
    if (isError(updated)) return updated;
    const queued = await enqueueCalendarPush(tx, { entryId: id }, "entry");
    return queued ?? updated[0] ?? null;
  }, ctx);

/** The actor's id when they may log this dose in the group (an Easy helper too); else null. */
const doseUploader = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  fields: Parameters<typeof canLogEntry>[2],
) => {
  if (!ctx.authUser || isSystemUser(ctx.authUser)) return null;
  const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
  if (isError(role)) return role;
  return canLogEntry(role, "dose", fields) ? ctx.authUser.id : null;
};

/**
 * Whether an upload brings this deleted dose back: not when the uploader
 * deleted it, and not when it is their own dose replayed (same author, same
 * time). The same author at another time is their other device's tap.
 */
const mayRestoreDose = (
  row: Pick<TimelineEntry, "createdBy" | "updatedBy" | "occurredAt">,
  uploader: string,
  occurredAt: string,
) =>
  row.updatedBy !== uploader &&
  !(row.createdBy === uploader && new Date(row.occurredAt).getTime() === new Date(occurredAt).getTime());

/**
 * Note an accepted dose upload (a first upload, a replay onto the uploader's
 * own row, a duplicate or a restore), in its transaction: it commits only if
 * the upload does. The row may change time or hands before a retry arrives,
 * so this note is what tells the retry from a new log (B-627, B-726).
 */
const recordDoseUpload = (tx: Tx, entryId: string, userId: string, occurredAt: string) =>
  dbMayFail(
    () => tx.insert(doseDuplicateUploadSchema).values({ entryId, userId, occurredAt }).onConflictDoNothing(),
    "timelineEntryService:duplicateRecord",
  );

/**
 * Note both uploads a restore settles, in its transaction: the one it displaced
 * and its own. The row keeps neither once it changes hands or its time is
 * edited, so a retry of either would otherwise pass for a new log (B-719).
 * `created_by` has no FK, so a displaced author with no user row (the system,
 * a deleted account) is skipped: they have no upload left to retry.
 */
const recordRestoredDose = async (
  tx: Tx,
  displaced: Pick<TimelineEntry, "id" | "createdBy" | "occurredAt">,
  uploader: string,
  occurredAt: string,
) => {
  const author = await dbMayFail(
    () => tx.select({ id: userSchema.id }).from(userSchema).where(eq(userSchema.id, displaced.createdBy)),
    "timelineEntryService:duplicateRecord",
  );
  if (isError(author)) return author;
  if (author.length > 0) {
    const noted = await recordDoseUpload(tx, displaced.id, displaced.createdBy, displaced.occurredAt);
    if (isError(noted)) return noted;
  }
  return recordDoseUpload(tx, displaced.id, uploader, occurredAt);
};

/** Whether this exact upload was already accepted without becoming the row: a retry, not a new log (B-627). */
const isAcceptedDuplicate = async (tx: Tx, entryId: string, userId: string, occurredAt: string) => {
  const rows = await dbMayFail(
    () =>
      tx
        .select({ entryId: doseDuplicateUploadSchema.entryId })
        .from(doseDuplicateUploadSchema)
        .where(
          and(
            eq(doseDuplicateUploadSchema.entryId, entryId),
            eq(doseDuplicateUploadSchema.userId, userId),
            eq(doseDuplicateUploadSchema.occurredAt, occurredAt),
          ),
        )
        .limit(1),
    "timelineEntryService:duplicateRecord",
  );
  return isError(rows) ? rows : rows.length > 0;
};

/**
 * The dose with this id when it is another member's and the actor may log
 * doses in its group; else null. An upload of the actor's own copy of it (a
 * PUT that already carries `deleted_at`, or a flagged PATCH) leaves it alone
 * (B-614). Viewers get null, so their upload is refused as usual.
 */
export const anotherMembersDose = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const row = await timelineEntryModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(row)) return row;
    if (row?.kind !== "dose") return null;
    const uploader = await doseUploader(ctx, tx, row.groupId, {});
    if (isError(uploader)) return uploader;
    return uploader && row.createdBy !== uploader ? row : null;
  }, ctx);

/**
 * Create the entry with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. Says whether it created
 * (`Upserted`).
 *
 * - A new id is a `create` (same validation and group check).
 * - An existing id is a replay of the create: it changes nothing (only a
 *   PATCH edits), whatever the actor's role now, so it never reverts a newer
 *   edit. Its group, recipient and kind must match: they never change.
 * - A deleted entry stays deleted (a delete wins over a late replay).
 * - A dose shares its id with the same answer for the same slot, so for
 *   anyone who may log one: onto a live row another member created, the first
 *   upload stands, nothing changes and the duplicate is recorded; onto a row
 *   another member deleted, it comes back as the uploader's, unless this is
 *   their own dose replayed or a retry of a recorded upload (B-627). Every
 *   accepted dose upload is recorded (B-726), and a restore also records the
 *   upload it displaced (B-719).
 *   Two first uploads of one id take turns, so the second is that duplicate.
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

    if (kind === "dose") {
      const locked = await timelineEntryModel.lockId(id, tx);
      if (isError(locked)) return locked;
    }

    // Existence is checked as the system, so a taken id is refused cleanly
    // rather than failing on the primary key.
    const existing = await timelineEntryModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) {
      const created = await create({ ...ctx, tx }, parsed.data);
      if (isError(created) || kind !== "dose") return asCreated(created);
      const noted = await recordOwnDoseUpload(ctx, tx, id, groupId, scheduling, occurredAt);
      return noted ?? asCreated(created);
    }

    const visible = await timelineEntryModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);

    if (
      visible.groupId !== groupId ||
      visible.kind !== kind ||
      (recipientId !== undefined && visible.recipientId !== recipientId)
    )
      return newError({ code: "timelineEntryService:immutable" });
    // Doses share an id per slot, so these run before the update permission:
    // an Easy helper can't update another member's row, but may log this dose.
    if (visible.kind === "dose") {
      const uploader = await doseUploader(ctx, tx, groupId, scheduling);
      if (isError(uploader)) return uploader;
      if (uploader) {
        if (!visible.deletedAt && visible.createdBy !== uploader) {
          const recorded = await recordDoseUpload(tx, id, uploader, occurredAt);
          return isError(recorded) ? recorded : unchanged(visible);
        }
        const retried =
          visible.deletedAt && mayRestoreDose(visible, uploader, occurredAt)
            ? await isAcceptedDuplicate(tx, id, uploader, occurredAt)
            : null;
        if (isError(retried)) return retried;
        if (retried === false) {
          const future = refuseFuture(kind, occurredAt);
          if (future) return future;
          const medication = await checkDoseMedication(ctx, tx, groupId, details);
          if (medication) return medication;
          const restored = await timelineEntryModel.restore(
            id,
            {
              title: title ?? null,
              body: body ?? null,
              occurredAt,
              timeZone,
              details: details ?? null,
              ...schedulingColumns(parsed.data),
              cancelledBy: null,
            },
            { ...ctx, tx },
          );
          if (isError(restored)) return restored;
          if (restored) {
            const noted = await recordRestoredDose(tx, visible, uploader, occurredAt);
            if (isError(noted)) return noted;
          }
          const queued = await enqueueCalendarPush(tx, { entryId: id }, "entry");
          // Made live again by this upload: as good as a create.
          return queued ?? asCreated(restored);
        }
      }
    }
    // A replay of the create (deleted since, or a change entry the service
    // wrote with the medication, or live): it changes nothing. A member's own
    // live dose is still noted as theirs (B-726).
    if (visible.kind === "dose" && !visible.deletedAt) {
      const noted = await recordOwnDoseUpload(ctx, tx, id, groupId, scheduling, occurredAt);
      if (noted) return noted;
    }
    return unchanged(visible);
  }, ctx);

/**
 * Note a dose upload that became (or updated) the uploader's own row, for
 * anyone who may log doses: a retry of it after a time edit, a restore or a
 * delete is then still a retry, not a new log (B-726). An error, else null.
 */
const recordOwnDoseUpload = async (
  ctx: ServiceContext,
  tx: Tx,
  id: string,
  groupId: string,
  fields: Parameters<typeof canLogEntry>[2],
  occurredAt: string,
) => {
  const uploader = await doseUploader(ctx, tx, groupId, fields);
  if (isError(uploader)) return uploader;
  if (!uploader) return null;
  const recorded = await recordDoseUpload(tx, id, uploader, occurredAt);
  return isError(recorded) ? recorded : null;
};

/**
 * Soft delete. The entry disappears from the timeline but syncs as deleted.
 * Todos linked to a deleted event lose the link in the same transaction
 * (todos PRD), as the todo table's FK does on a hard delete.
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const visible = await timelineEntryModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    if (visible) {
      const mayDelete = await timelineEntryModel.mayChange(id, "delete", { ...ctx, tx });
      if (isError(mayDelete)) return mayDelete;
      if (!mayDelete) return rejectError(ctx.authUser);
    }
    const res = await timelineEntryModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return notFound();
    if (isError(res)) return res;
    const released = await releaseEvent(tx, id);
    if (isError(released)) return released;
    const queued = await enqueueCalendarPush(tx, { entryId: id }, "entry");
    return queued ?? res;
  }, ctx);

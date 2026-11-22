import type { SeriesKind, TimelineEntryContent } from "@caretook/data/schema";
import type { PlanSeries, PlanVisit, SeriesEditChange, SeriesScope } from "@caretook/data/series";
import type { TimelineEntry } from "../core/rpc";
import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { EntryRow, LocalQuery } from "../timeline/timeline.sync";

import {
  addDays,
  appointmentSeriesCreateZSchema,
  dayInZone,
  entryProviderId,
  SERIES_AHEAD_DAYS,
  seriesVisitId,
  timelineEntryContentZSchema,
} from "@caretook/data/schema";
import { and, eq, isNull } from "drizzle-orm";
import { rescheduleEvent } from "./appointments.sync";
import {
  appointmentSeries,
  noteDocuments,
  timelineEntries,
  timelineEntryProviders,
  todos,
} from "../sync/schema";
import {
  contentColumns,
  forbidden,
  groupFor,
  invalid,
  missing,
  nowTimestamp,
  readRows,
  removeEntry,
  toTimelineEntry,
  updateEntry,
  WRITER_ROLES,
} from "../timeline/timeline.sync";

// Repeating appointments on the device (appointments-2).
// `createSeries` writes a series and its visits in one local transaction;
// `seriesQuery` reads one for the entry page. Expanding a rule needs rrule
// (`@caretook/data/series`), loaded here only when a series is written, so
// pages that only read a series never load it. The device never tops up: the
// server does.

/** What a new series is made from: its rule and its template. */
export type NewSeries = {
  groupId: string;
  kind: SeriesKind;
  rule: string;
  /** The first local day ("YYYY-MM-DD") in `timeZone`. */
  startsOn: string;
  /** "HH:MM" in `timeZone`; null when all day. */
  startTime: string | null;
  allDay: boolean;
  /** The recipient's zone. */
  timeZone: string;
  title: string | null;
  durationMinutes: number | null;
  place: string | null;
  providerIds: string[];
};

export type CreateSeriesResult =
  { ok: true; seriesId: string; firstVisitId: string; visits: number } | Extract<ActionResult, { ok: false }>;

const refuse = (error: string, issues: { path: string; message: string }[] = []): CreateSeriesResult => ({
  ok: false,
  error,
  issues,
});

/**
 * Write a series and every visit through today + 90 days (or its first
 * visit, if that's later) in **one local transaction**, so the upload queue
 * has the series before its visits and each visit before its document and
 * links. Each visit is an ordinary note or event from the template, with
 * its id from `seriesVisitId`, its provider links and an empty document.
 *
 * `firstVisit` is the draft or new entry the series was set up from: it
 * becomes the first visit and keeps its id (and notes), moved to the first
 * day the rule gives. Writers only; validated with the server's rules.
 */
export const createSeries = async (
  db: SyncDb,
  input: NewSeries,
  { firstVisit, now = new Date() }: { firstVisit?: string; now?: Date } = {},
): Promise<CreateSeriesResult> => {
  const group = await groupFor(db, input.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden as CreateSeriesResult;
  if (!group.recipient) return refuse("This care group has no care recipient yet");

  // The entry it was set up from, if it's already stored: it must be live, in
  // the group, of the series' kind and not in a series yet. Its providers join the template's.
  const [adopted] = firstVisit
    ? await readRows<EntryRow>(db, { sql: "SELECT * FROM timeline_entry WHERE id = ?", params: [firstVisit] })
    : [];
  const stored = adopted ? toTimelineEntry(adopted) : null;
  if (adopted && (!stored || stored.groupId !== input.groupId || stored.deletedAt))
    return missing as CreateSeriesResult;
  if (stored && (stored.kind !== input.kind || stored.seriesId)) return refuse("This entry can't repeat");
  const links = firstVisit
    ? await readRows<{ id: string; provider_id: string }>(db, {
        sql: `SELECT l.id, l.provider_id FROM timeline_entry_provider l
              JOIN provider p ON p.id = l.provider_id AND p.deleted_at IS NULL
              WHERE l.entry_id = ? ORDER BY l.created_at, l.id`,
        params: [firstVisit],
      })
    : [];
  const providerIds = [...new Set([...input.providerIds, ...links.map((l) => l.provider_id)])];

  const seriesId = crypto.randomUUID();
  const today = dayInZone(now, input.timeZone);
  const parsed = appointmentSeriesCreateZSchema.safeParse({
    ...input,
    providerIds,
    id: seriesId,
    recipientId: group.recipient.id,
    toppedUpThrough: addDays(today, SERIES_AHEAD_DAYS),
  });
  if (!parsed.success)
    return { ...invalid(parsed.error), error: "The repeat is invalid" } as CreateSeriesResult;
  const series = parsed.data;

  const { nextVisits, seriesVisits } = await import("@caretook/data/series");
  const [first] = nextVisits(series, series.startsOn, 1);
  if (!first)
    return refuse("This repeat has no visits", [{ path: "rule", message: "This repeat has no visits" }]);
  const through = first.day > series.toppedUpThrough! ? first.day : series.toppedUpThrough!;
  const visits = seriesVisits(series, series.startsOn, through);

  const event = series.kind === "event";
  const rows: { id: string; content: TimelineEntryContent }[] = [];
  for (const [index, visit] of visits.entries()) {
    const id = index === 0 && firstVisit ? firstVisit : seriesVisitId(seriesId, visit.day);
    const content = timelineEntryContentZSchema.safeParse({
      kind: series.kind,
      title: series.title,
      occurredAt: visit.start,
      timeZone: series.timeZone,
      details: null,
      allDay: series.allDay,
      ...(event && { endsAt: visit.end, place: series.place }),
      seriesId,
      seriesDay: visit.day,
    });
    if (!content.success) return invalid(content.error) as CreateSeriesResult;
    rows.push({ id, content: content.data });
  }

  const hasDocument = firstVisit
    ? (
        await readRows<{ id: string }>(db, {
          sql: "SELECT id FROM note_document WHERE id = ?",
          params: [firstVisit],
        })
      ).length > 0
    : false;
  const linked = new Set(links.map((l) => l.id));

  const at = nowTimestamp();
  const audit = { createdAt: at, updatedAt: at, createdBy: db.userId, updatedBy: db.userId };
  await db.drizzle.transaction(async (tx) => {
    await tx.insert(appointmentSeries).values({
      id: seriesId,
      groupId: series.groupId,
      recipientId: group.recipient!.id,
      kind: series.kind,
      rule: series.rule,
      startsOn: series.startsOn,
      startTime: series.startTime,
      allDay: series.allDay ? 1 : 0,
      timeZone: series.timeZone,
      title: series.title,
      durationMinutes: series.durationMinutes,
      place: series.place,
      providerIds: JSON.stringify(series.providerIds),
      toppedUpThrough: series.toppedUpThrough,
      deletedAt: null,
      ...audit,
    });
    for (const { id, content } of rows) {
      const { kind: _kind, ...columns } = content;
      if (stored && id === stored.id) {
        await tx
          .update(timelineEntries)
          .set({ ...contentColumns(columns), title: stored.title, updatedAt: at, updatedBy: db.userId })
          .where(eq(timelineEntries.id, id));
      } else {
        await tx.insert(timelineEntries).values({
          id,
          groupId: series.groupId,
          recipientId: group.recipient!.id,
          kind: series.kind,
          ...contentColumns(columns),
          cancelledBy: null,
          deletedAt: null,
          ...audit,
        });
      }
      if (!(id === firstVisit && hasDocument)) {
        await tx.insert(noteDocuments).values({
          id,
          groupId: series.groupId,
          subject: "entry",
          entryId: id,
          providerId: null,
          snapshot: null,
          text: "",
          ...audit,
        });
      }
      for (const providerId of series.providerIds) {
        const linkId = entryProviderId(id, providerId);
        if (linked.has(linkId)) continue;
        await tx.insert(timelineEntryProviders).values({
          id: linkId,
          groupId: series.groupId,
          entryId: id,
          providerId,
          ...audit,
        });
      }
    }
  });
  return { ok: true, seriesId, firstVisitId: rows[0]!.id, visits: rows.length };
};

// ---------------------------------------------------------------------------
// Editing a series
// ---------------------------------------------------------------------------

export type FullSeriesRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  kind: string | null;
  rule: string | null;
  starts_on: string | null;
  start_time: string | null;
  all_day: number | null;
  time_zone: string | null;
  title: string | null;
  duration_minutes: number | null;
  place: string | null;
  provider_ids: string | null;
  topped_up_through: string | null;
  deleted_at: string | null;
};

export const toPlanSeries = (row: FullSeriesRow): PlanSeries | null => {
  if (!row.group_id || !row.recipient_id || !row.rule || !row.starts_on || !row.time_zone) return null;
  let providerIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.provider_ids ?? "[]");
    if (Array.isArray(parsed)) providerIds = parsed.filter((p): p is string => typeof p === "string");
  } catch {
    providerIds = [];
  }
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id,
    kind: row.kind === "note" ? "note" : "event",
    rule: row.rule,
    startsOn: row.starts_on,
    startTime: row.start_time,
    allDay: row.all_day === 1,
    timeZone: row.time_zone,
    title: row.title,
    durationMinutes: row.duration_minutes,
    place: row.place,
    providerIds,
    toppedUpThrough: row.topped_up_through,
  };
};

type VisitRow = EntryRow & { touched: number };

/** A series' visits (deleted ones too), each with whether it has notes or linked todos. */
const visitsSql = `SELECT e.*,
    (EXISTS (SELECT 1 FROM note_document d WHERE d.id = e.id AND d.text IS NOT NULL AND d.text != '')
      OR EXISTS (SELECT 1 FROM note_update u WHERE u.document_id = e.id)
      OR EXISTS (SELECT 1 FROM todo t WHERE t.event_id = e.id AND t.deleted_at IS NULL)) AS touched
  FROM timeline_entry e WHERE e.series_id = ? ORDER BY e.series_day`;

const toPlanVisit = (row: VisitRow): PlanVisit | null => {
  const entry = toTimelineEntry(row);
  if (!entry?.seriesDay) return null;
  return {
    id: entry.id,
    seriesDay: entry.seriesDay,
    occurredAt: entry.occurredAt,
    endsAt: entry.endsAt ?? null,
    allDay: !!entry.allDay,
    title: entry.title,
    place: entry.place ?? null,
    cancelledAt: entry.cancelledAt ?? null,
    detached: entry.seriesDetached,
    deleted: !!entry.deletedAt,
    touched: row.touched === 1,
  };
};

export type SeriesEditResult =
  { ok: true; seriesId: string | null; visitId: string } | Extract<ActionResult, { ok: false }>;

const failed = (error: string): SeriesEditResult => ({ ok: false, error, issues: [] });

/** An entry with a patch, checked with the content rules: the columns to write. */
const patched = (entry: TimelineEntry, patch: Record<string, unknown>) =>
  timelineEntryContentZSchema.safeParse({
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    occurredAt: entry.occurredAt,
    timeZone: entry.timeZone,
    details: entry.details,
    allDay: entry.allDay,
    endsAt: entry.endsAt,
    place: entry.place,
    cancelledAt: entry.cancelledAt,
    cancelReason: entry.cancelReason,
    rescheduledTo: entry.rescheduledTo,
    seriesId: entry.seriesId,
    seriesDay: entry.seriesDay,
    seriesDetached: entry.seriesDetached,
    ...patch,
  });

/**
 * Change a series visit, for "Only this visit" or "This and later visits"
 * (`planSeriesEdit`). Only this visit is the ordinary single write (the
 * visit detached): an update, the cancel and reschedule writes, or a soft
 * delete. This and later runs the whole plan in **one local transaction**:
 * the new series, the old one ended (or deleted), then the visits moved,
 * detached, deleted and added (each new one with its provider links and an
 * empty document). Past visits are never written. Writers only.
 */
export const applySeriesEdit = async (
  db: SyncDb,
  {
    visitId,
    scope,
    change,
    now = new Date(),
  }: { visitId: string; scope: SeriesScope; change: SeriesEditChange; now?: Date },
): Promise<SeriesEditResult> => {
  const [visitRow] = await readRows<EntryRow>(db, {
    sql: "SELECT * FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [visitId],
  });
  const visit = visitRow ? toTimelineEntry(visitRow) : null;
  if (!visit) return missing as SeriesEditResult;
  const group = await groupFor(db, visit.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden as SeriesEditResult;
  if (!visit.seriesId) return failed("This isn't a repeating visit");

  const [seriesRow] = await readRows<FullSeriesRow>(db, {
    sql: "SELECT * FROM appointment_series WHERE id = ?",
    params: [visit.seriesId],
  });
  const series = seriesRow ? toPlanSeries(seriesRow) : null;
  if (!series) return failed("This visit's series hasn't synced yet");
  const rows = await readRows<VisitRow>(db, { sql: visitsSql, params: [visit.seriesId] });
  const visits = rows.map(toPlanVisit).filter((v): v is PlanVisit => !!v);

  const { planSeriesEdit } = await import("@caretook/data/series");
  const newSeriesId = crypto.randomUUID();
  const planned = planSeriesEdit({ series, visits, visit: visitId, scope, change, now, newSeriesId });
  if (!planned.ok) return failed(planned.problem);
  const { plan } = planned;

  // Only this visit: one ordinary write.
  if (scope === "only") {
    const [write] = plan.entries;
    if (!write) return { ok: true, seriesId: null, visitId };
    if (write.op === "delete") {
      const res = await removeEntry(db, write.id);
      return res.ok ? { ok: true, seriesId: null, visitId } : res;
    }
    if (write.op === "reschedule") {
      const res = await rescheduleEvent(db, write.id, {
        occurredAt: write.occurredAt,
        endsAt: write.endsAt,
        allDay: write.allDay,
        keepOldAsCancelled: write.keepOld,
      });
      return res.ok ? { ok: true, seriesId: null, visitId: res.id } : res;
    }
    if (write.op === "update") {
      const res = await updateEntry(db, write.id, write.patch, { detach: true });
      return res.ok ? { ok: true, seriesId: null, visitId } : res;
    }
    return failed("This change can't be made to one visit");
  }

  // This and later: check every write first, then one transaction.
  const entries = new Map(rows.map((r) => [r.id, toTimelineEntry(r)]));
  const next = plan.newSeries;
  const updates: { id: string; columns: ReturnType<typeof contentColumns>; cancelled: boolean }[] = [];
  const creates: { id: string; content: TimelineEntryContent }[] = [];
  for (const write of plan.entries) {
    if (write.op === "update") {
      const entry = entries.get(write.id);
      if (!entry) return missing as SeriesEditResult;
      const merged = patched(entry, write.patch);
      if (!merged.success) return invalid(merged.error) as SeriesEditResult;
      const { kind: _kind, ...content } = merged.data;
      updates.push({ id: write.id, columns: contentColumns(content), cancelled: !!merged.data.cancelledAt });
    } else if (write.op === "create" && next) {
      const content = timelineEntryContentZSchema.safeParse({
        kind: next.kind,
        title: next.title,
        occurredAt: write.occurredAt,
        timeZone: next.timeZone,
        details: null,
        allDay: next.allDay,
        ...(next.kind === "event" && { endsAt: write.endsAt, place: next.place }),
        seriesId: next.id,
        seriesDay: write.day,
      });
      if (!content.success) return invalid(content.error) as SeriesEditResult;
      creates.push({ id: write.id, content: content.data });
    }
  }
  const deletes = plan.entries.filter((w) => w.op === "delete").map((w) => w.id);

  const at = nowTimestamp();
  const audit = { createdAt: at, updatedAt: at, createdBy: db.userId, updatedBy: db.userId };
  const changed = { updatedAt: at, updatedBy: db.userId };
  await db.drizzle.transaction(async (tx) => {
    if (next) {
      await tx.insert(appointmentSeries).values({
        id: next.id,
        groupId: next.groupId,
        recipientId: next.recipientId,
        kind: next.kind,
        rule: next.rule,
        startsOn: next.startsOn,
        startTime: next.startTime,
        allDay: next.allDay ? 1 : 0,
        timeZone: next.timeZone,
        title: next.title,
        durationMinutes: next.durationMinutes,
        place: next.place,
        providerIds: JSON.stringify(next.providerIds),
        toppedUpThrough: next.toppedUpThrough,
        deletedAt: null,
        ...audit,
      });
    }
    if (plan.seriesPatch) {
      await tx
        .update(appointmentSeries)
        .set({ rule: plan.seriesPatch.rule, ...changed })
        .where(eq(appointmentSeries.id, plan.seriesPatch.id));
    }
    if (plan.deleteSeries) {
      await tx
        .update(appointmentSeries)
        .set({ deletedAt: at, ...changed })
        .where(eq(appointmentSeries.id, plan.deleteSeries));
    }
    for (const { id, columns, cancelled } of updates) {
      const entry = entries.get(id)!;
      const cancelledBy = cancelled ? (entry.cancelledAt ? entry.cancelledBy : db.userId) : null;
      await tx
        .update(timelineEntries)
        .set({ ...columns, cancelledBy, ...changed })
        .where(eq(timelineEntries.id, id));
    }
    for (const id of deletes) {
      await tx
        .update(timelineEntries)
        .set({ deletedAt: at, ...changed })
        .where(eq(timelineEntries.id, id));
      // As removeEntry: events pointing at it lose the link, and so do its todos.
      await tx
        .update(timelineEntries)
        .set({ rescheduledTo: null, ...changed })
        .where(and(eq(timelineEntries.rescheduledTo, id), isNull(timelineEntries.deletedAt)));
      await tx
        .update(todos)
        .set({ eventId: null, ...changed })
        .where(and(eq(todos.eventId, id), isNull(todos.deletedAt)));
    }
    for (const { id, content } of creates) {
      const { kind: _kind, ...columns } = content;
      await tx.insert(timelineEntries).values({
        id,
        groupId: next!.groupId,
        recipientId: next!.recipientId,
        kind: next!.kind,
        ...contentColumns(columns),
        cancelledBy: null,
        deletedAt: null,
        ...audit,
      });
      await tx.insert(noteDocuments).values({
        id,
        groupId: next!.groupId,
        subject: "entry",
        entryId: id,
        providerId: null,
        snapshot: null,
        text: "",
        ...audit,
      });
      for (const providerId of next!.providerIds) {
        await tx.insert(timelineEntryProviders).values({
          id: entryProviderId(id, providerId),
          groupId: next!.groupId,
          entryId: id,
          providerId,
          ...audit,
        });
      }
    }
  });
  return { ok: true, seriesId: next?.id ?? null, visitId };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type SeriesRow = {
  id: string;
  group_id: string | null;
  kind: string | null;
  rule: string | null;
  starts_on: string | null;
  start_time: string | null;
  all_day: number | null;
  time_zone: string | null;
  deleted_at: string | null;
};

/** One series (deleted ones too: a visit still shows what it repeated). */
export const seriesQuery = (seriesId: string | null): LocalQuery => ({
  sql: "SELECT id, group_id, kind, rule, starts_on, start_time, all_day, time_zone, deleted_at FROM appointment_series WHERE id = ?",
  params: [seriesId ?? ""],
});

/** A series row as `repeatText` takes it, or null for a half-synced row. */
export const toRepeatInput = (row: SeriesRow | undefined) =>
  row?.rule && row.starts_on
    ? {
        rule: row.rule,
        startsOn: row.starts_on,
        startTime: row.start_time,
        allDay: row.all_day === 1,
        kind: row.kind === "note" ? ("note" as const) : ("event" as const),
      }
    : null;

/** One series with its whole template (the series edit sheet). */
export const fullSeriesQuery = (seriesId: string | null): LocalQuery => ({
  sql: "SELECT * FROM appointment_series WHERE id = ?",
  params: [seriesId ?? ""],
});

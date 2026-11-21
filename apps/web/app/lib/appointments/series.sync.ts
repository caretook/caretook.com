import type { SeriesKind, TimelineEntryContent } from "@caretook/data/schema";
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
import { eq } from "drizzle-orm";
import { appointmentSeries, noteDocuments, timelineEntries, timelineEntryProviders } from "../sync/schema";
import {
  contentColumns,
  forbidden,
  groupFor,
  invalid,
  missing,
  nowTimestamp,
  readRows,
  toTimelineEntry,
  WRITER_ROLES,
} from "../timeline/timeline.sync";

// Repeating appointments and reminders on the device (appointments-2).
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

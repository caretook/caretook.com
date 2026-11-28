// Editing a series (appointments-2, B-60): what a change to one visit writes,
// for "Only this visit" and "This and later visits". Pure and client-safe,
// over `seriesVisits` (so rrule), and part of the `@caretook/data/series`
// entry: the web app loads it only when a series edit runs.
//
// - **Only this visit:** the visit changes and is detached (later series
//   edits leave it as it is). Cancel and reschedule are the ordinary
//   single-event writes; delete is a soft delete.
// - **This and later:** the series is split. The old one ends the day before
//   this visit (UNTIL), or is soft-deleted when this is its first visit; a
//   new series starts on this visit's day with the change. Future visits
//   from this one on are moved onto it in place (same id, notes and todos)
//   when their day is still in the rule; otherwise they're deleted, unless
//   they have notes, todos or a cancel: then they're detached and kept.
//   Detached visits are left alone, and days the new rule adds are written.
//   Cancelling or deleting this and later ends the series the same way.
// - **Past visits** (started before `now`) are never in the writes, and
//   "This and later" from a past visit is refused.

import type { SeriesKind } from "./appointmentSeries";

import { addDays, localDate } from "../../../domain/core/entryTiming";
import { dayInZone, startOfDay, timeInZone } from "../../../domain/core/zonedDay";
import { seriesCrossFieldIssues } from "./appointmentSeries";
import {
  parseRule,
  ruleText,
  SERIES_AHEAD_DAYS,
  seriesVisitId,
} from "../../../domain/appointments/repeatRule";
import { seriesDays, visitOn } from "../../../domain/appointments/seriesVisits";

export const SERIES_SCOPES = ["only", "later"] as const;
export type SeriesScope = (typeof SERIES_SCOPES)[number];

/** A series as the plan reads it (an `appointment_series` row, camelCase). */
export type PlanSeries = {
  id: string;
  groupId: string;
  recipientId: string;
  kind: SeriesKind;
  rule: string;
  startsOn: string;
  startTime: string | null;
  allDay: boolean;
  timeZone: string;
  title: string | null;
  durationMinutes: number | null;
  place: string | null;
  providerIds: string[];
  toppedUpThrough: string | null;
};

/** One of the series' visits (deleted ones too: their days stay taken). */
export type PlanVisit = {
  id: string;
  seriesDay: string;
  occurredAt: string;
  endsAt: string | null;
  allDay: boolean;
  title: string | null;
  place: string | null;
  cancelledAt: string | null;
  detached: boolean;
  deleted: boolean;
  /** It has notes (text in its document) or linked todos. */
  touched: boolean;
};

/**
 * What changes. An edit names only what it changes: a visit's own fields
 * (title, place, time) for "only", and for "later" also the series' start
 * time, length and rule (or a new time, whose time of day and length the
 * series takes).
 */
export type SeriesEditChange =
  | {
      action: "edit";
      title?: string | null;
      place?: string | null;
      occurredAt?: string;
      endsAt?: string | null;
      allDay?: boolean;
      /** "This and later": the series' time ("HH:MM", null when all day), length and rule. */
      startTime?: string | null;
      durationMinutes?: number | null;
      rule?: string;
    }
  | { action: "cancel"; reason?: string | null }
  | { action: "delete" }
  | { action: "reschedule"; occurredAt: string; endsAt: string | null; allDay: boolean; keepOld: boolean };

export type SeriesVisitPatch = {
  title?: string | null;
  place?: string | null;
  occurredAt?: string;
  endsAt?: string | null;
  allDay?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  seriesId?: string;
  seriesDetached?: boolean;
};

export type SeriesEntryWrite =
  /** Change a visit in place. */
  | { op: "update"; id: string; patch: SeriesVisitPatch }
  /** A new visit of the new series, from its template, with its providers' links and an empty document. */
  | { op: "create"; id: string; seriesId: string; day: string; occurredAt: string; endsAt: string | null }
  /** Soft delete. */
  | { op: "delete"; id: string }
  /** "Only this visit": the ordinary reschedule (the old one cancelled when `keepOld`; then it's detached). */
  | {
      op: "reschedule";
      id: string;
      occurredAt: string;
      endsAt: string | null;
      allDay: boolean;
      keepOld: boolean;
    };

export type SeriesPlan = {
  /** The series "This and later" starts (written first). */
  newSeries: PlanSeries | null;
  /** The old series' new rule: it ends the day before. */
  seriesPatch: { id: string; rule: string } | null;
  /** The old series, soft-deleted (this and later from its first visit). */
  deleteSeries: string | null;
  /** Visits, in order. Never a past one. */
  entries: SeriesEntryWrite[];
};

export type SeriesPlanResult = { ok: true; plan: SeriesPlan } | { ok: false; problem: string };

const fail = (problem: string): SeriesPlanResult => ({ ok: false, problem });
const EMPTY: Omit<SeriesPlan, "entries"> = { newSeries: null, seriesPatch: null, deleteSeries: null };

/** Whether a visit has started (an all-day one lasts to the end of its day). Past visits are never rewritten. */
export const isPastVisit = (visit: Pick<PlanVisit, "occurredAt" | "allDay">, timeZone: string, now: Date) => {
  if (!visit.allDay) return new Date(visit.occurredAt).getTime() < now.getTime();
  const day = localDate(visit.occurredAt, timeZone);
  return startOfDay(addDays(day, 1), timeZone).getTime() <= now.getTime();
};

/** The rule, ending on `until` (inclusive) instead of how it ended. */
export const ruleUntil = (rule: string, until: string) => {
  const parsed = parseRule(rule);
  return parsed.ok ? ruleText({ ...parsed.rule, end: { type: "on", until } }) : rule;
};

/** The rule for the visits from `splitDay` on: "after N" counts only what's left. */
export const ruleFrom = (series: Pick<PlanSeries, "rule" | "startsOn">, splitDay: string) => {
  const parsed = parseRule(series.rule);
  if (!parsed.ok || parsed.rule.end.type !== "after") return series.rule;
  const before = seriesDays(series, series.startsOn, addDays(splitDay, -1)).length;
  const count = Math.max(1, parsed.rule.end.count - before);
  return ruleText({ ...parsed.rule, end: { type: "after", count } });
};

const minutesBetween = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);

/** "Only this visit": the visit's own write, detached. */
const onlyThis = (
  series: PlanSeries,
  visit: PlanVisit,
  change: SeriesEditChange,
  now: Date,
): SeriesPlanResult => {
  const event = series.kind === "event";
  const write = (patch: SeriesVisitPatch): SeriesPlanResult => ({
    ok: true,
    plan: { ...EMPTY, entries: [{ op: "update", id: visit.id, patch: { ...patch, seriesDetached: true } }] },
  });
  switch (change.action) {
    case "delete":
      return { ok: true, plan: { ...EMPTY, entries: [{ op: "delete", id: visit.id }] } };
    case "cancel":
      if (!event) return fail("Only events can be cancelled");
      return write({ cancelledAt: now.toISOString(), cancelReason: change.reason?.trim() || null });
    case "reschedule":
      if (!event) return fail("Only events can be rescheduled");
      return {
        ok: true,
        plan: {
          ...EMPTY,
          entries: [
            {
              op: "reschedule",
              id: visit.id,
              occurredAt: change.occurredAt,
              endsAt: change.allDay ? null : change.endsAt,
              allDay: change.allDay,
              keepOld: change.keepOld,
            },
          ],
        },
      };
    case "edit": {
      const patch: SeriesVisitPatch = {};
      if (change.title !== undefined) patch.title = change.title;
      if (event && change.place !== undefined) patch.place = change.place;
      if (change.occurredAt !== undefined) patch.occurredAt = change.occurredAt;
      if (change.allDay !== undefined) patch.allDay = change.allDay;
      if (event && change.endsAt !== undefined) patch.endsAt = change.allDay ? null : change.endsAt;
      return write(patch);
    }
  }
};

/** The new series' template for "This and later": the old one with the change. */
const templateFrom = (
  series: PlanSeries,
  change: Extract<SeriesEditChange, { action: "edit" | "reschedule" }>,
) => {
  const event = series.kind === "event";
  let { startTime, allDay, durationMinutes } = series;
  if (change.occurredAt !== undefined) {
    allDay = change.allDay ?? allDay;
    startTime = allDay ? null : timeInZone(new Date(change.occurredAt), series.timeZone);
    if (event)
      durationMinutes = !allDay && change.endsAt ? minutesBetween(change.occurredAt, change.endsAt) : null;
  }
  if (change.action === "edit") {
    if (change.allDay !== undefined) allDay = change.allDay;
    if (change.startTime !== undefined) startTime = change.startTime;
    if (change.durationMinutes !== undefined) durationMinutes = change.durationMinutes;
    if (allDay) startTime = null;
  }
  if (allDay || !event) durationMinutes = null;
  const title = change.action === "edit" && change.title !== undefined ? change.title : series.title;
  const place = event && change.action === "edit" && change.place !== undefined ? change.place : series.place;
  return { startTime, allDay, durationMinutes, title, place: event ? place : null };
};

/** The writes that end the old series before `splitDay` (UNTIL the day before, or deleted from its first visit). */
const ending = (series: PlanSeries, splitDay: string) => {
  const first = seriesDays(series, series.startsOn, addDays(splitDay, -1)).length === 0;
  return first
    ? { seriesPatch: null, deleteSeries: series.id }
    : {
        seriesPatch: { id: series.id, rule: ruleUntil(series.rule, addDays(splitDay, -1)) },
        deleteSeries: null,
      };
};

/**
 * The writes for a change to one visit of a series, for either scope.
 * `newSeriesId` is the id "This and later" gives the series it starts.
 */
export const planSeriesEdit = ({
  series,
  visits,
  visit: visitId,
  scope,
  change,
  now,
  newSeriesId,
}: {
  series: PlanSeries;
  visits: readonly PlanVisit[];
  /** The visit the change was made on. */
  visit: string;
  scope: SeriesScope;
  change: SeriesEditChange;
  now: Date;
  newSeriesId: string;
}): SeriesPlanResult => {
  const visit = visits.find((v) => v.id === visitId && !v.deleted);
  if (!visit) return fail("This visit is gone");
  if (scope === "only") return onlyThis(series, visit, change, now);
  const tz = series.timeZone;
  if (isPastVisit(visit, tz, now)) return fail("A past visit can't change the visits after it");
  if (change.action === "cancel" && series.kind !== "event") return fail("Only events can be cancelled");

  const splitDay = visit.seriesDay;
  const end = ending(series, splitDay);
  // Live, future visits from this one on (this one first).
  const later = visits
    .filter((v) => !v.deleted && v.seriesDay >= splitDay && !isPastVisit(v, tz, now))
    .sort((a, b) =>
      a.id === visit.id ? -1 : b.id === visit.id ? 1 : a.seriesDay.localeCompare(b.seriesDay),
    );
  const entries: SeriesEntryWrite[] = [];
  const kept = (v: PlanVisit) => v.touched || !!v.cancelledAt;

  if (change.action === "delete") {
    for (const v of later) {
      if (v.id !== visit.id && kept(v)) {
        if (!v.detached) entries.push({ op: "update", id: v.id, patch: { seriesDetached: true } });
      } else entries.push({ op: "delete", id: v.id });
    }
    return { ok: true, plan: { ...EMPTY, ...end, entries } };
  }

  if (change.action === "cancel") {
    const cancel: SeriesVisitPatch = {
      cancelledAt: now.toISOString(),
      cancelReason: change.reason?.trim() || null,
      seriesDetached: true,
    };
    for (const v of later) {
      if (v.cancelledAt) {
        if (!v.detached) entries.push({ op: "update", id: v.id, patch: { seriesDetached: true } });
      } else if (v.id === visit.id || v.touched || v.detached)
        entries.push({ op: "update", id: v.id, patch: cancel });
      else entries.push({ op: "delete", id: v.id });
    }
    return { ok: true, plan: { ...EMPTY, ...end, entries } };
  }

  // Edit (or reschedule) this and later: a new series from this visit's day.
  const today = dayInZone(now, tz);
  const ahead = addDays(today, SERIES_AHEAD_DAYS);
  const through = series.toppedUpThrough && series.toppedUpThrough > ahead ? series.toppedUpThrough : ahead;
  const template = templateFrom(series, change);
  const rule = (change.action === "edit" && change.rule) || ruleFrom(series, splitDay);
  const next: PlanSeries = {
    ...series,
    ...template,
    id: newSeriesId,
    rule,
    startsOn: splitDay,
    toppedUpThrough: through,
  };
  const parsed = parseRule(rule);
  if (!parsed.ok) return fail(parsed.problem);
  const issue = seriesCrossFieldIssues(next)[0];
  if (issue) return fail(issue.message);

  const event = series.kind === "event";
  const days = new Set(seriesDays(next, splitDay, through));
  const covered = new Set<string>();
  // Days left to other visits: deleted ones (a visit removed on its own stays removed), and kept ones.
  const taken = new Set(visits.filter((v) => v.deleted && v.seriesDay >= splitDay).map((v) => v.seriesDay));

  for (const v of later) {
    if (v.detached && v.id !== visit.id) {
      taken.add(v.seriesDay);
      continue;
    }
    if (days.has(v.seriesDay)) {
      const at = visitOn(next, v.seriesDay);
      const patch: SeriesVisitPatch = { seriesId: next.id };
      if (v.detached) patch.seriesDetached = false;
      if (new Date(v.occurredAt).getTime() !== new Date(at.start).getTime()) patch.occurredAt = at.start;
      if (v.allDay !== next.allDay) patch.allDay = next.allDay;
      if (
        event &&
        (v.endsAt ? new Date(v.endsAt).getTime() : null) !== (at.end ? new Date(at.end).getTime() : null)
      )
        patch.endsAt = at.end;
      if (change.action === "edit" && change.title !== undefined && v.title !== next.title)
        patch.title = next.title;
      if (event && change.action === "edit" && change.place !== undefined && v.place !== next.place)
        patch.place = next.place;
      entries.push({ op: "update", id: v.id, patch });
      covered.add(v.seriesDay);
    } else if (kept(v)) {
      if (!v.detached) entries.push({ op: "update", id: v.id, patch: { seriesDetached: true } });
      taken.add(v.seriesDay);
    } else entries.push({ op: "delete", id: v.id });
  }

  for (const day of days) {
    if (covered.has(day) || taken.has(day)) continue;
    const at = visitOn(next, day);
    if (isPastVisit({ occurredAt: at.start, allDay: next.allDay }, tz, now)) continue;
    entries.push({
      op: "create",
      id: seriesVisitId(next.id, day),
      seriesId: next.id,
      day,
      occurredAt: at.start,
      endsAt: event ? at.end : null,
    });
  }

  return { ok: true, plan: { ...end, newSeries: next, entries } };
};

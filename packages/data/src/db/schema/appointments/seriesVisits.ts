// A series' visits in a range of local days, over `rrule` (2.8.1). Pure and
// client-safe, but its own entry (`@caretook/data/series`), not the schema
// index: rrule must stay out of the first-load bundle, so the web app loads
// this only from the repeat field and the series writes.
//
// The rule is expanded in floating wall-clock time (rrule's "UTC" dates read
// as the local day and time), then each day's time is placed in the series'
// zone with `zonedInstant`: a time the clocks skip moves forward, a repeated
// one takes the first, as dose slots do. COUNT counts from the series' first
// day; UNTIL is a local date, inclusive.

import type { Options } from "rrule";
import type { RepeatRule, Weekday } from "./repeatRule";

import * as rruleModule from "rrule";
import { addDays } from "../core/entryTiming";
import { startOfDay, zonedInstant } from "../core/zonedDay";
import { parseRule } from "./repeatRule";

// rrule ships ESM (named exports) for bundlers and a UMD build for Node,
// whose named exports Node can't see: take whichever this runtime loaded.
type RRuleModule = typeof rruleModule;
const rrule: RRuleModule =
  (rruleModule as Partial<RRuleModule>).RRule !== undefined
    ? rruleModule
    : (rruleModule as unknown as { default: RRuleModule }).default;
const { RRule } = rrule;

/** What expanding a series needs (an `appointment_series` row has it all). */
export type SeriesTiming = {
  rule: string;
  /** The first local day ("YYYY-MM-DD"). */
  startsOn: string;
  /** "HH:MM" in `timeZone`, or null when all day. */
  startTime: string | null;
  allDay: boolean;
  timeZone: string;
  /** An appointment's length; null for none (or all day). */
  durationMinutes?: number | null;
};

/** One visit: its local day, and when it starts and ends (ISO 8601; no end when all day or without a length). */
export type SeriesVisit = { day: string; start: string; end: string | null };

/** A local day (and wall time) as rrule's floating "UTC" date. */
const floating = (day: string, time = "00:00", seconds = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d, hh, mm, seconds));
};

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

const RRULE_DAYS: Record<Weekday, (typeof RRule)["MO"]> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const FREQS = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY } as const;

/** rrule's options for a parsed rule starting on `startsOn` (floating midnight: only days matter). */
export const rruleOptions = (rule: RepeatRule, startsOn: string): Partial<Options> => ({
  freq: FREQS[rule.freq],
  interval: rule.interval,
  wkst: RRule.MO,
  dtstart: floating(startsOn),
  ...(rule.freq === "weekly" && { byweekday: rule.weekdays.map((d) => RRULE_DAYS[d]) }),
  ...(rule.monthly?.by === "date" && { bymonthday: [rule.monthly.day] }),
  ...(rule.monthly?.by === "weekday" && {
    byweekday: [RRULE_DAYS[rule.monthly.weekday].nth(rule.monthly.nth)],
  }),
  ...(rule.end.type === "after" && { count: rule.end.count }),
  ...(rule.end.type === "on" && { until: floating(rule.end.until, "23:59", 59) }),
});

/**
 * The local days ("YYYY-MM-DD") the series falls on from `from` through `to`
 * (both inclusive, local days), soonest first. An unreadable rule has none.
 */
export const seriesDays = (series: Pick<SeriesTiming, "rule" | "startsOn">, from: string, to: string) => {
  const parsed = parseRule(series.rule);
  if (!parsed.ok || to < from) return [];
  const start = from < series.startsOn ? series.startsOn : from;
  if (to < start) return [];
  const expander = new RRule(rruleOptions(parsed.rule, series.startsOn));
  return expander
    .between(floating(start), floating(addDays(to, 1)), true)
    .map(dayOf)
    .filter((d) => d <= to);
};

/** A day's visit: when it starts in the series' zone, and its end. */
export const visitOn = (series: SeriesTiming, day: string): SeriesVisit => {
  if (series.allDay || !series.startTime) {
    return { day, start: startOfDay(day, series.timeZone).toISOString(), end: null };
  }
  const start = zonedInstant(day, series.startTime, series.timeZone);
  const end = series.durationMinutes ? new Date(start.getTime() + series.durationMinutes * 60_000) : null;
  return { day, start: start.toISOString(), end: end?.toISOString() ?? null };
};

/** The series' visits from `from` through `to` (local days, inclusive), soonest first. */
export const seriesVisits = (series: SeriesTiming, from: string, to: string): SeriesVisit[] =>
  seriesDays(series, from, to).map((day) => visitOn(series, day));

/**
 * The first day ("YYYY-MM-DD") the rule falls on on or after `from`, however
 * far ahead (bounded only by its own COUNT or UNTIL, and rrule's year 9999);
 * null once it has ended or when the rule can't be read.
 */
export const firstDayFrom = (series: Pick<SeriesTiming, "rule" | "startsOn">, from: string) => {
  const parsed = parseRule(series.rule);
  if (!parsed.ok) return null;
  const start = from < series.startsOn ? series.startsOn : from;
  const date = new RRule(rruleOptions(parsed.rule, series.startsOn)).after(floating(start), true);
  return date ? dayOf(date) : null;
};

/** The first `n` visits on or after `from` (the repeat field's preview). Looks at most about 5 years ahead. */
export const nextVisits = (series: SeriesTiming, from: string, n: number): SeriesVisit[] => {
  const parsed = parseRule(series.rule);
  if (!parsed.ok) return [];
  const start = from < series.startsOn ? series.startsOn : from;
  const expander = new RRule(rruleOptions(parsed.rule, series.startsOn));
  const days: string[] = [];
  const limit = floating(addDays(start, 5 * 366));
  expander.between(floating(start), limit, true, (date) => {
    days.push(dayOf(date));
    return days.length < n;
  });
  return days.map((day) => visitOn(series, day));
};

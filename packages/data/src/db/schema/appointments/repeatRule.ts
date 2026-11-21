// A series' repeat rule (appointments-2): the RRULE subset Caretook writes,
// as text and as a structured value, its wording ("Every Mon, Wed, Fri at
// 6:00 · until 31 Jan") and visit ids. Pure and client-safe, with no
// dependency: expanding a rule into visits needs `rrule`, which lives in
// `seriesVisits.ts` (its own entry, `@caretook/data/series`) so it stays off
// pages that never expand one.

import { addDays } from "../core/entryTiming";
import { uuidV5 } from "../core/uuidV5";

/** RRULE weekday codes, Monday first (the week starts on Monday: `WKST=MO`). */
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const REPEAT_FREQS = ["daily", "weekly", "monthly"] as const;
export type RepeatFreq = (typeof REPEAT_FREQS)[number];

/** Which week of the month: 1st to 5th, or the last (-1). */
export const MONTH_WEEKS = [1, 2, 3, 4, 5, -1] as const;
export type MonthWeek = (typeof MONTH_WEEKS)[number];

/** A monthly rule: on a date (the 15th), or on the nth weekday (the 2nd Tuesday). */
export type MonthlyBy = { by: "date"; day: number } | { by: "weekday"; nth: MonthWeek; weekday: Weekday };

/** When a series ends: never, on a local date (inclusive), or after a number of visits. */
export type RepeatEnd = { type: "never" } | { type: "on"; until: string } | { type: "after"; count: number };

export type RepeatRule = {
  freq: RepeatFreq;
  /** Every N days, weeks or months (1 to `SERIES_LIMITS.interval`). */
  interval: number;
  /** Weekly: the days, at least one (in `WEEKDAYS` order). Empty otherwise. */
  weekdays: Weekday[];
  /** Monthly: on a date or an nth weekday. Null otherwise. */
  monthly: MonthlyBy | null;
  end: RepeatEnd;
};

export const SERIES_LIMITS = {
  interval: 99,
  count: 500,
  title: 200,
  place: 200,
  providers: 20,
  /** An event's length: up to a day. */
  durationMinutes: 24 * 60,
} as const;

/** How far ahead a series' visits are written: through today + 90 days (device and server). */
export const SERIES_AHEAD_DAYS = 90;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isDate = (value: string) => {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
};

const sortedDays = (days: readonly Weekday[]) => WEEKDAYS.filter((d) => days.includes(d));

// ---------------------------------------------------------------------------
// RRULE text
// ---------------------------------------------------------------------------

/** The rule as RRULE text: `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20270131`. */
export const ruleText = (rule: RepeatRule) => {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`, `INTERVAL=${rule.interval}`];
  if (rule.freq === "weekly") parts.push(`BYDAY=${sortedDays(rule.weekdays).join(",")}`);
  if (rule.freq === "monthly" && rule.monthly?.by === "date") parts.push(`BYMONTHDAY=${rule.monthly.day}`);
  if (rule.freq === "monthly" && rule.monthly?.by === "weekday")
    parts.push(`BYDAY=${rule.monthly.nth}${rule.monthly.weekday}`);
  if (rule.end.type === "after") parts.push(`COUNT=${rule.end.count}`);
  if (rule.end.type === "on") parts.push(`UNTIL=${rule.end.until.replaceAll("-", "")}`);
  return parts.join(";");
};

/** Why a rule can't be saved, worded for the form; null when it can. */
export type RuleProblem = string;

const intIn = (value: string | undefined, min: number, max: number) => {
  if (value === undefined || !/^-?\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

/**
 * RRULE text → the structured rule, or why it isn't one Caretook writes:
 * FREQ DAILY, WEEKLY or MONTHLY; INTERVAL; BYDAY (weekly: plain days;
 * monthly: one day with an ordinal); BYMONTHDAY (monthly); COUNT or UNTIL
 * (a date), never both. Anything else is refused.
 */
export const parseRule = (
  text: string,
): { ok: true; rule: RepeatRule } | { ok: false; problem: RuleProblem } => {
  const fail = (problem: string) => ({ ok: false as const, problem });
  const fields = new Map<string, string>();
  for (const part of text.trim().split(";")) {
    const [key, value, ...rest] = part.split("=");
    if (!key || value === undefined || rest.length || fields.has(key))
      return fail("This repeat isn't supported");
    fields.set(key.toUpperCase(), value.toUpperCase());
  }
  const known = ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "COUNT", "UNTIL"];
  if ([...fields.keys()].some((k) => !known.includes(k))) return fail("This repeat isn't supported");

  const freq = fields.get("FREQ")?.toLowerCase();
  if (!REPEAT_FREQS.includes(freq as RepeatFreq)) return fail("Choose daily, weekly or monthly");

  const interval = fields.has("INTERVAL") ? intIn(fields.get("INTERVAL"), 1, SERIES_LIMITS.interval) : 1;
  if (interval === null) return fail(`Repeat every 1 to ${SERIES_LIMITS.interval}`);

  if (fields.has("COUNT") && fields.has("UNTIL"))
    return fail("End on a date or after a number of visits, not both");
  let end: RepeatEnd = { type: "never" };
  if (fields.has("COUNT")) {
    const count = intIn(fields.get("COUNT"), 1, SERIES_LIMITS.count);
    if (count === null) return fail(`End after 1 to ${SERIES_LIMITS.count} visits`);
    end = { type: "after", count };
  }
  if (fields.has("UNTIL")) {
    const raw = fields.get("UNTIL")!;
    const until = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
    if (!isDate(until)) return fail("Enter a valid end date");
    end = { type: "on", until };
  }

  const byDay = fields.get("BYDAY");
  const byMonthDay = fields.get("BYMONTHDAY");
  const base = { interval, end };

  if (freq === "daily") {
    if (byDay !== undefined || byMonthDay !== undefined) return fail("This repeat isn't supported");
    return { ok: true, rule: { ...base, freq: "daily", weekdays: [], monthly: null } };
  }

  if (freq === "weekly") {
    if (byMonthDay !== undefined) return fail("This repeat isn't supported");
    const days = (byDay ?? "").split(",").filter(Boolean);
    if (!days.length) return fail("Choose at least one day");
    if (days.some((d) => !WEEKDAYS.includes(d as Weekday)) || new Set(days).size !== days.length)
      return fail("This repeat isn't supported");
    return {
      ok: true,
      rule: { ...base, freq: "weekly", weekdays: sortedDays(days as Weekday[]), monthly: null },
    };
  }

  // Monthly: a date, or one weekday with its week.
  if ((byDay === undefined) === (byMonthDay === undefined))
    return fail("Choose a date or a weekday in the month");
  if (byMonthDay !== undefined) {
    const day = intIn(byMonthDay, 1, 31);
    if (day === null) return fail("Choose a date from 1 to 31");
    return { ok: true, rule: { ...base, freq: "monthly", weekdays: [], monthly: { by: "date", day } } };
  }
  const match = /^(-1|[1-5])(MO|TU|WE|TH|FR|SA|SU)$/.exec(byDay!);
  if (!match) return fail("Choose a date or a weekday in the month");
  const monthly: MonthlyBy = {
    by: "weekday",
    nth: Number(match[1]) as MonthWeek,
    weekday: match[2] as Weekday,
  };
  return { ok: true, rule: { ...base, freq: "monthly", weekdays: [], monthly } };
};

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const DAY_NAMES: Record<Weekday, { short: string; long: string }> = {
  MO: { short: "Mon", long: "Monday" },
  TU: { short: "Tue", long: "Tuesday" },
  WE: { short: "Wed", long: "Wednesday" },
  TH: { short: "Thu", long: "Thursday" },
  FR: { short: "Fri", long: "Friday" },
  SA: { short: "Sat", long: "Saturday" },
  SU: { short: "Sun", long: "Sunday" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

const WEEK_WORDS: Record<MonthWeek, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
  4: "4th",
  5: "5th",
  [-1]: "last",
};

export const weekdayName = (day: Weekday, style: "short" | "long" = "long") => DAY_NAMES[day][style];

/** "HH:MM" → "6:00", "18:30" (the 24-hour clock, as the series stores it). */
const clock = (time: string) => {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
};

/** "2027-01-31" → "31 Jan", or "31 Jan 2028" when it's more than a year after `startsOn` (or there's none). */
const shortDate = (day: string, startsOn?: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const year = !startsOn || day > addDays(startsOn, 365) ? ` ${y}` : "";
  return `${d} ${MONTHS[m! - 1]}${year}`;
};

const every = (interval: number, unit: string, alone: string) =>
  interval === 1 ? alone : `Every ${interval} ${unit}s`;

/** What a rule repeats on, without the time or the end: "Every Mon, Wed, Fri", "Monthly on the 2nd Tuesday". */
export const repeatPattern = (rule: RepeatRule) => {
  if (rule.freq === "daily") return every(rule.interval, "day", "Every day");
  if (rule.freq === "weekly") {
    const days = sortedDays(rule.weekdays)
      .map((d) => DAY_NAMES[d].short)
      .join(", ");
    return rule.interval === 1 ? `Every ${days}` : `Every ${rule.interval} weeks on ${days}`;
  }
  const on =
    rule.monthly?.by === "date"
      ? `the ${ordinal(rule.monthly.day)}`
      : rule.monthly
        ? `the ${WEEK_WORDS[rule.monthly.nth]} ${DAY_NAMES[rule.monthly.weekday].long}`
        : "";
  return `${every(rule.interval, "month", "Monthly")} on ${on}`;
};

export type RepeatTextInput = {
  rule: string;
  /** "HH:MM", or null when all day. */
  startTime: string | null;
  allDay?: boolean;
  /** The series' first day: an end date more than a year later shows its year. */
  startsOn?: string;
  /** Visits (events) or times (reminders) in "· 12 visits". */
  kind?: "event" | "note";
};

/**
 * The repeat in words: "Every Mon, Wed, Fri at 6:00 · until 31 Jan", "Every
 * 4 weeks on Tue at 9:00", "Monthly on the 2nd Tuesday", "Every 3 days ·
 * 12 visits". All-day series have no time. An unreadable rule is "Repeats".
 */
export const repeatText = (series: RepeatTextInput) => {
  const parsed = parseRule(series.rule);
  if (!parsed.ok) return "Repeats";
  const { rule } = parsed;
  const time = !series.allDay && series.startTime ? ` at ${clock(series.startTime)}` : "";
  const noun = series.kind === "note" ? "time" : "visit";
  const end =
    rule.end.type === "on"
      ? ` · until ${shortDate(rule.end.until, series.startsOn)}`
      : rule.end.type === "after"
        ? ` · ${rule.end.count} ${noun}${rule.end.count === 1 ? "" : "s"}`
        : "";
  return `${repeatPattern(rule)}${time}${end}`;
};

// ---------------------------------------------------------------------------
// Visit ids
// ---------------------------------------------------------------------------

/** The namespace for visit ids (a fixed, random UUID; never change it). */
export const SERIES_VISIT_NAMESPACE = "3f9b6a1e-2c4d-4b8a-9e7f-5d1c0a2b8e64";

/**
 * A visit's id: the version 5 UUID of its series and its local day, so a
 * device and the server writing the same visit land on one row.
 */
export const seriesVisitId = (seriesId: string, day: string) =>
  uuidV5(`${seriesId.toLowerCase()}:${day}`, SERIES_VISIT_NAMESPACE);

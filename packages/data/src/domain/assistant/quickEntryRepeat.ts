import type { RepeatFreq, Weekday } from "../appointments/repeatRule";

import { addDays } from "../core/entryTiming";
import { ruleText, SERIES_LIMITS, WEEKDAYS } from "../appointments/repeatRule";
import { findVocabulary, vocabularyWord } from "./quickEntryVocabulary";

// Quick entry's repeats (planner-3, B-254): "bins out every monday" is a
// todo that repeats weekly on Monday. A phrase opens with a `repeatWord` row
// of the vocabulary ("every", "daily", "weekly", "monthly"); this module
// reads the rest of it. Pure and client-safe, with no rrule: rules are built
// as text (`ruleText`) and the first day is plain date arithmetic, so the
// parser stays out of `@caretook/data/series`. English only.
//
// Read: daily, every day, every other day, every N days; every monday (one
// or several days: "every mon, wed and fri", "every weekday"); weekly, every
// week, every other week, every N weeks (on given days, else the first
// day's); monthly, every month, every month on the 15th, on the 1st of every
// month. Never "every 4 hours". Ends, "last friday", "twice a week" and yearly
// are set in the Repeat sheet.

export type QuickEntryRepeat = {
  /** RRULE text, as todos store it (`FREQ=WEEKLY;INTERVAL=1;BYDAY=MO`). */
  rule: string;
  /** The first day ("YYYY-MM-DD") the rule falls on, from the start day included. */
  firstDay: string;
  /** The indexes of the words the phrase took up. */
  used: Set<number>;
};

const WEEKDAY_WORDS: Record<string, Weekday> = {
  mon: "MO",
  monday: "MO",
  tue: "TU",
  tues: "TU",
  tuesday: "TU",
  wed: "WE",
  weds: "WE",
  wednesday: "WE",
  thu: "TH",
  thur: "TH",
  thurs: "TH",
  thursday: "TH",
  fri: "FR",
  friday: "FR",
  sat: "SA",
  saturday: "SA",
  sun: "SU",
  sunday: "SU",
};

/** Words for every working day. */
const WORKDAY_WORDS = new Set(["weekday", "weekdays"]);
const WORKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];

/** Between weekdays in a list: "mon, wed and fri", "tue & thu" (commas are gone from the words). */
const LIST_LINKS = new Set(["and", "&", "+", "or"]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
/** "every second week", like "every other week". */
const ORDINAL_INTERVALS: Record<string, number> = { other: 2, second: 2, third: 3, fourth: 4 };

const UNITS: Record<string, RepeatFreq> = {
  day: "daily",
  days: "daily",
  week: "weekly",
  weeks: "weekly",
  month: "monthly",
  months: "monthly",
};

/** A weekday as one word ("mondays", "tue"); null when it isn't one. */
const weekdayOf = (word: string | undefined): Weekday | null => {
  if (!word) return null;
  const w = vocabularyWord(word);
  return WEEKDAY_WORDS[w] ?? (w.endsWith("s") ? (WEEKDAY_WORDS[w.slice(0, -1)] ?? null) : null);
};

/** The weekdays one word says: "monday", or "mon/wed/fri". */
const weekdaysIn = (word: string | undefined): Weekday[] | null => {
  if (!word) return null;
  const days = word.split("/").map(weekdayOf);
  return days.every((d) => d !== null) ? days : null;
};

/** A day of the month as typed: "15th", "1st" (or a bare number after "the"). */
const monthDayOf = (word: string | undefined, bare: boolean) => {
  const match = word ? /^(\d{1,2})(st|nd|rd|th)?$/.exec(word) : null;
  if (!match || (!match[2] && !bare)) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
};

const weekdayOfDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  // getUTCDay counts from Sunday; WEEKDAYS from Monday.
  return WEEKDAYS[(new Date(Date.UTC(y!, m! - 1, d)).getUTCDay() + 6) % 7]!;
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * The first day on or after `from` that the rule falls on. A monthly date a
 * month doesn't have (the 31st in November) skips that month, as the rule
 * does when it repeats.
 */
const firstDayOf = (
  freq: RepeatFreq,
  weekdays: readonly Weekday[],
  monthDay: number | null,
  from: string,
): string => {
  if (freq === "daily") return from;
  if (freq === "weekly") {
    let day = from;
    while (!weekdays.includes(weekdayOfDate(day))) day = addDays(day, 1);
    return day;
  }
  let [year, month] = from.split("-").map(Number) as [number, number];
  for (;;) {
    if (monthDay! <= daysInMonth(year, month)) {
      const day = `${year}-${String(month).padStart(2, "0")}-${String(monthDay).padStart(2, "0")}`;
      if (day >= from) return day;
    }
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
};

/**
 * The repeat among `tokens` (a part's words, lowercase), if it says one:
 * its rule, its first day (from `from`, default `today`, included) and the
 * words it took. Only words `free` allows are read. A weekly rule with no
 * day said repeats on the first day's weekday, a monthly one on its date.
 */
export const readRepeat = (
  tokens: readonly string[],
  today: string,
  { free = () => true, from = today }: { free?: (i: number) => boolean; from?: string } = {},
): QuickEntryRepeat | null => {
  const start = from < today ? today : from;
  const words = tokens.map(vocabularyWord);
  const ok = (j: number) => j >= 0 && j < tokens.length && free(j);
  const at = (j: number) => (ok(j) ? words[j] : undefined);

  /** A list of weekdays from word `j`: "mon, wed and fri", "monday & thursday". */
  const weekdayList = (j: number) => {
    const days: Weekday[] = [];
    const used: number[] = [];
    let p = j;
    for (;;) {
      const said = ok(p) ? weekdaysIn(tokens[p]) : null;
      if (!said) break;
      days.push(...said);
      used.push(p);
      p++;
      let q = p;
      while (ok(q) && LIST_LINKS.has(tokens[q]!)) q++;
      if (q === p || !(ok(q) && weekdaysIn(tokens[q]))) continue;
      for (let k = p; k < q; k++) used.push(k);
      p = q;
    }
    return days.length ? { days: [...new Set(days)], used } : null;
  };

  /** "on monday", "on mon and thu" after a weekly word. */
  const onWeekdays = (j: number) => {
    const on = at(j) === "on";
    const list = weekdayList(on ? j + 1 : j);
    return list ? { days: list.days, used: on ? [j, ...list.used] : list.used } : null;
  };

  /** "on the 15th", "the 15th" after a monthly word. */
  const onMonthDay = (j: number) => {
    let p = j;
    if (at(p) === "on") p++;
    const the = at(p) === "the";
    if (the) p++;
    const day = monthDayOf(at(p), the);
    return day === null ? null : { day, used: Array.from({ length: p - j + 1 }, (_, k) => j + k) };
  };

  /** "the 1st of" before "every month": "on the 1st of every month". */
  const monthDayBefore = (i: number) => {
    if (at(i - 1) !== "of") return null;
    const the = at(i - 3) === "the";
    const day = monthDayOf(at(i - 2), the);
    if (day === null) return null;
    let first = the ? i - 3 : i - 2;
    if (at(first - 1) === "on") first--;
    return { day, used: Array.from({ length: i - first }, (_, k) => first + k) };
  };

  const make = (
    freq: RepeatFreq,
    interval: number,
    used: number[],
    weekdays: Weekday[] = [],
    monthDay: number | null = null,
  ): QuickEntryRepeat | null => {
    if (interval < 1 || interval > SERIES_LIMITS.interval) return null;
    const days = freq === "weekly" && !weekdays.length ? [weekdayOfDate(start)] : weekdays;
    const date = freq === "monthly" ? (monthDay ?? Number(start.slice(8, 10))) : null;
    const rule = ruleText({
      freq,
      interval,
      weekdays: freq === "weekly" ? days : [],
      monthly: date === null ? null : { by: "date", day: date },
      end: { type: "never" },
    });
    return { rule, firstDay: firstDayOf(freq, days, date, start), used: new Set(used) };
  };

  const readAt = (i: number): QuickEntryRepeat | null => {
    const word = words[i];
    if (word === "daily") return make("daily", 1, [i]);
    if (word === "weekly") {
      const on = onWeekdays(i + 1);
      return make("weekly", 1, [i, ...(on?.used ?? [])], on?.days);
    }
    if (word === "monthly") {
      const on = onMonthDay(i + 1);
      return make("monthly", 1, [i, ...(on?.used ?? [])], [], on?.day);
    }
    if (word !== "every") return null;

    // "every", then "other" or a number, then a unit or weekdays.
    let j = i + 1;
    let interval = 1;
    const next = at(j);
    if (next !== undefined && next in ORDINAL_INTERVALS) {
      interval = ORDINAL_INTERVALS[next]!;
      j++;
    } else if (next !== undefined && (/^\d+$/.test(next) || next in NUMBER_WORDS)) {
      interval = /^\d+$/.test(next) ? Number(next) : NUMBER_WORDS[next]!;
      j++;
    }
    const used = Array.from({ length: j - i }, (_, k) => i + k);
    const unit = at(j);
    if (unit !== undefined && unit in UNITS) {
      const freq = UNITS[unit]!;
      used.push(j);
      if (freq === "weekly") {
        const on = onWeekdays(j + 1);
        return make("weekly", interval, [...used, ...(on?.used ?? [])], on?.days);
      }
      if (freq === "monthly") {
        const on = onMonthDay(j + 1) ?? monthDayBefore(i);
        return make("monthly", interval, [...used, ...(on?.used ?? [])], [], on?.day);
      }
      return make("daily", interval, used);
    }
    if (unit !== undefined && WORKDAY_WORDS.has(unit))
      return make("weekly", interval, [...used, j], WORKDAYS);
    const list = weekdayList(j);
    if (list) return make("weekly", interval, [...used, ...list.used], list.days);
    // "every 4 hours", "every time": not a repeat.
    return null;
  };

  for (const match of findVocabulary(words, ok)) {
    if (match.entry.role !== "repeatWord") continue;
    const found = readAt(match.used[0]!);
    if (found) return found;
  }
  return null;
};

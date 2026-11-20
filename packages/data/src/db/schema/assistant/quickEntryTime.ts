import { addDays, localDate } from "../core/entryTiming";

// Time phrases in quick entry ("at 8am", "30 min ago", "yesterday 9pm",
// "last night", "tue 2pm", "nov 20"), found among a line's words and
// resolved in the recipient's time zone. Pure and client-safe; the parser
// (quickEntry.ts) uses it. English only.

export type Clock = { hour: number; minute: number; meridiem?: "am" | "pm" };
export type DaySpec =
  | { offset: number }
  | { weekday: number; modifier?: "next" | "last" | "this" }
  | { month: number; date: number };
export type Period = "morning" | "afternoon" | "evening" | "night";

/** What a phrase says: minutes from now, or a day and/or a time of day. */
export type TimeSpec = { relativeMinutes: number } | { day?: DaySpec; clock?: Clock; period?: Period };

export type FoundTime = {
  spec: TimeSpec;
  /** The indexes of the words the phrase took up. */
  used: Set<number>;
};

/** Which way an ambiguous phrase leans: past for what happened, future for what's planned. */
export type TimeDirection = "past" | "future";

export type ResolvedTime = {
  /** The moment. */
  at: Date;
  /** A day without a time of day ("tomorrow", "tue"): an all-day item, for kinds that have one. */
  allDay: boolean;
};

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const PERIOD_CLOCK: Record<Period, Clock> = {
  morning: { hour: 8, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 19, minute: 0 },
  night: { hour: 22, minute: 0 },
};

const MINUTE_UNITS = new Set(["m", "min", "mins", "minute", "minutes"]);
const HOUR_UNITS = new Set(["h", "hr", "hrs", "hour", "hours"]);
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, few: 3, couple: 2 };

const meridiemOf = (text: string | undefined): "am" | "pm" | undefined => {
  if (!text) return undefined;
  const t = text.replace(/\./g, "");
  if (t === "am" || t === "a") return "am";
  if (t === "pm" || t === "p") return "pm";
  return undefined;
};

const validClock = (hour: number, minute: number, meridiem?: "am" | "pm") =>
  minute >= 0 && minute < 60 && (meridiem ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23);

/** A clock time in one word ("8am", "8:30pm", "20:00", "9:30"), or null. Bare numbers aren't times. */
const clockWord = (word: string): Clock | null => {
  if (word === "noon" || word === "midday") return { hour: 12, minute: 0, meridiem: "pm" };
  if (word === "midnight") return { hour: 12, minute: 0, meridiem: "am" };
  const withMeridiem = /^(\d{1,2})(?::(\d{2}))?(am|pm|a\.m\.?|p\.m\.?|a|p)$/.exec(word);
  if (withMeridiem) {
    const hour = Number(withMeridiem[1]);
    const minute = Number(withMeridiem[2] ?? 0);
    const meridiem = meridiemOf(withMeridiem[3]);
    return validClock(hour, minute, meridiem) ? { hour, minute, meridiem } : null;
  }
  const colon = /^(\d{1,2}):(\d{2})$/.exec(word);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    return validClock(hour, minute) ? { hour, minute } : null;
  }
  return null;
};

const numberWord = (word: string | undefined): number | null => {
  if (!word) return null;
  if (/^\d+(\.\d+)?$/.test(word)) return Number(word);
  return COUNT_WORDS[word] ?? null;
};

/** "30min", "2h", "2hrs": a number and a unit in one word. */
const amountWithUnit = (word: string | undefined): number | null => {
  const m = word ? /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(word) : null;
  if (!m) return null;
  const n = Number(m[1]);
  if (MINUTE_UNITS.has(m[2]!)) return n;
  if (HOUR_UNITS.has(m[2]!)) return n * 60;
  return null;
};

/**
 * A run of words saying how long: "30 min", "2 hours", "an hour", "half an
 * hour", "30min". Returns the minutes and how many words it took, or null.
 */
const duration = (words: readonly string[], i: number): { minutes: number; length: number } | null => {
  const joined = amountWithUnit(words[i]);
  if (joined !== null) return { minutes: joined, length: 1 };
  if (
    words[i] === "half" &&
    (words[i + 1] === "an" || words[i + 1] === "a") &&
    HOUR_UNITS.has(words[i + 2] ?? "")
  )
    return { minutes: 30, length: 3 };
  // "a few minutes", "a couple of hours"
  let start = i;
  if (words[i] === "a" && (words[i + 1] === "few" || words[i + 1] === "couple")) start = i + 1;
  const n = numberWord(words[start]);
  if (n === null) return null;
  let unitAt = start + 1;
  if (words[unitAt] === "of") unitAt++;
  const unit = words[unitAt] ?? "";
  if (MINUTE_UNITS.has(unit)) return { minutes: n, length: unitAt - i + 1 };
  if (HOUR_UNITS.has(unit)) return { minutes: n * 60, length: unitAt - i + 1 };
  return null;
};

const DAY_UNITS = new Set(["d", "day", "days"]);

/** "2 days", "a day", "3d": a whole number of days, and how many words it took. */
const dayCount = (words: readonly string[], i: number): { days: number; length: number } | null => {
  const joined = words[i] ? /^(\d+)d$/.exec(words[i]) : null;
  if (joined) return { days: Number(joined[1]), length: 1 };
  const n = numberWord(words[i]);
  if (n === null || !Number.isInteger(n) || !DAY_UNITS.has(words[i + 1] ?? "")) return null;
  return { days: n, length: 2 };
};

/** "o2 sat 95" is oxygen, not Saturday: a short weekday before a bare number, or after "o2", isn't one. */
const notAWeekday = (words: readonly string[], i: number) => {
  const word = words[i]!;
  if (word.length > 5) return false;
  if (["o2", "spo2", "oxygen"].includes(words[i - 1] ?? "")) return true;
  const next = words[i + 1] ?? "";
  const bareNumber = /^\d+(\.\d+)?%?$/.test(next) && !meridiemOf(words[i + 2]);
  return bareNumber;
};

/**
 * The time phrase among `words` (lowercase, punctuation trimmed), if any:
 * the first of each part (a day, a time of day, minutes ago or ahead) is
 * kept, and the words they took are reported so the parser skips them.
 */
export const findTime = (words: readonly string[]): FoundTime | null => {
  const used = new Set<number>();
  let day: DaySpec | undefined;
  let clock: Clock | undefined;
  let period: Period | undefined;
  let relativeMinutes: number | undefined;
  const take = (from: number, length: number) => {
    for (let k = from; k < from + length; k++) used.add(k);
  };

  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const word = words[i]!;
    const next = words[i + 1];

    // "2 days ago", "in 3 days": a day, at this time of day.
    if (!day) {
      const ago = dayCount(words, i);
      if (ago && words[i + ago.length] === "ago") {
        day = { offset: -ago.days };
        take(i, ago.length + 1);
        continue;
      }
      const ahead = word === "in" ? dayCount(words, i + 1) : null;
      if (ahead) {
        day = { offset: ahead.days };
        take(i, ahead.length + 1);
        continue;
      }
    }

    // "30 min ago", "an hour ago", "in 2 hours"
    if (relativeMinutes === undefined) {
      const span = duration(words, i);
      if (span && words[i + span.length] === "ago") {
        relativeMinutes = -span.minutes;
        take(i, span.length + 1);
        continue;
      }
      if (word === "in") {
        const ahead = duration(words, i + 1);
        if (ahead) {
          relativeMinutes = ahead.minutes;
          take(i, ahead.length + 1);
          continue;
        }
      }
      if (word === "just" && next === "now") {
        relativeMinutes = 0;
        take(i, 2);
        continue;
      }
    }

    if (!day) {
      if (word === "today") {
        day = { offset: 0 };
        take(i, 1);
        continue;
      }
      if (word === "tonight") {
        day = { offset: 0 };
        period = period ?? "night";
        take(i, 1);
        continue;
      }
      if (["tomorrow", "tmrw", "tmr", "tomorow"].includes(word)) {
        day = { offset: 1 };
        take(i, 1);
        continue;
      }
      if (["yesterday", "yday", "yest"].includes(word)) {
        day = { offset: -1 };
        take(i, 1);
        continue;
      }
      if (word === "last" && next === "night") {
        day = { offset: -1 };
        period = "night";
        take(i, 2);
        continue;
      }
      if (word === "this" && next && ["morning", "afternoon", "evening"].includes(next)) {
        day = { offset: 0 };
        period = next as Period;
        take(i, 2);
        continue;
      }
      const modifier = word === "next" || word === "last" || word === "this" ? word : undefined;
      const dayWord = modifier ? next : word;
      if (dayWord && dayWord in WEEKDAYS && !notAWeekday(words, modifier ? i + 1 : i)) {
        day = { weekday: WEEKDAYS[dayWord]!, ...(modifier && { modifier }) };
        take(i, modifier ? 2 : 1);
        continue;
      }
      // "nov 20", "november 20th", "20 nov"
      const dateOf = (w: string | undefined) => {
        const m = w ? /^(\d{1,2})(st|nd|rd|th)?$/.exec(w) : null;
        const n = m ? Number(m[1]) : NaN;
        return n >= 1 && n <= 31 ? n : null;
      };
      if (word in MONTHS && dateOf(next) !== null && !(words[i + 2] && meridiemOf(words[i + 2]))) {
        day = { month: MONTHS[word]!, date: dateOf(next)! };
        take(i, 2);
        continue;
      }
      if (next && next in MONTHS && dateOf(word) !== null && /(st|nd|rd|th)$|^\d+$/.test(word)) {
        if (words[i - 1] === "on" || /(st|nd|rd|th)$/.test(word)) {
          day = { month: MONTHS[next]!, date: dateOf(word)! };
          take(i, 2);
          continue;
        }
      }
    }

    if (!clock) {
      // "at 8am", "at 8:30", "8 am", "at 8" (a bare hour needs "at"), "8am"
      const at = word === "at" ? 1 : 0;
      const first = words[i + at];
      const one = first ? clockWord(first) : null;
      if (one) {
        clock = one;
        take(i, at + 1);
        // "8:30 pm" as two words
        const m = meridiemOf(words[i + at + 1]);
        if (m && !one.meridiem && validClock(one.hour, one.minute, m)) {
          clock = { ...one, meridiem: m };
          take(i + at + 1, 1);
        }
        if (words[i + at + 1] === "o'clock") take(i + at + 1, 1);
        continue;
      }
      if (first && /^\d{1,2}$/.test(first)) {
        const hour = Number(first);
        const m = meridiemOf(words[i + at + 1]);
        if (m && validClock(hour, 0, m)) {
          clock = { hour, minute: 0, meridiem: m };
          take(i, at + 2);
          continue;
        }
        if (at && words[i + 2] === "o'clock" && validClock(hour, 0)) {
          clock = { hour, minute: 0 };
          take(i, 3);
          continue;
        }
        if (at && validClock(hour, 0)) {
          clock = { hour, minute: 0 };
          take(i, 2);
          continue;
        }
      }
    }

    if (
      !period &&
      word === "in" &&
      next === "the" &&
      ["morning", "afternoon", "evening"].includes(words[i + 2] ?? "")
    ) {
      period = words[i + 2] as Period;
      take(i, 3);
      continue;
    }
    if (!period && word === "at" && next === "night") {
      period = "night";
      take(i, 2);
      continue;
    }
  }

  if (relativeMinutes !== undefined && !day && !clock) return { spec: { relativeMinutes }, used };
  if (!day && !clock && !period) return null;
  return { spec: { day, clock, period }, used };
};

// ---------------------------------------------------------------------------
// Resolving a phrase to a moment, in a zone
// ---------------------------------------------------------------------------

const wallFormats = new Map<string, Intl.DateTimeFormat>();
const wallFormat = (timeZone: string) => {
  let format = wallFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    wallFormats.set(timeZone, format);
  }
  return format;
};

const wallParts = (at: number, timeZone: string) => {
  const parts = Object.fromEntries(
    wallFormat(timeZone)
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  return {
    asUtc: Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    ),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? ""),
  };
};

const HOUR_MS = 3_600_000;

/**
 * The moment a wall-clock time happens on a day ("YYYY-MM-DD") in a zone.
 * A time the clocks skip moves forward by the gap; a repeated one is the
 * first. (The same rule as the web's `zonedInstant`.)
 */
export const wallTime = (date: string, hour: number, minute: number, timeZone: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y!, m! - 1, d, hour, minute);
  const offsetAt = (t: number) => wallParts(t, timeZone).asUtc - Math.floor(t / 60_000) * 60_000;
  const before = wall - offsetAt(wall - 14 * HOUR_MS);
  const after = wall - offsetAt(wall + 14 * HOUR_MS);
  const valid = [before, after].filter((t) => wallParts(t, timeZone).asUtc === wall);
  return new Date(valid.length ? Math.min(...valid) : before);
};

/** 24-hour hours for a clock: with am/pm as said, else 1–6 read as afternoon, 7–11 as morning. */
const hour24 = ({ hour, meridiem }: Clock, period?: Period) => {
  if (hour > 12) return hour;
  const pm =
    meridiem ?? (period === "afternoon" || period === "evening" || period === "night" ? "pm" : undefined);
  if (pm === "am") return hour === 12 ? 0 : hour;
  if (pm === "pm") return hour === 12 ? 12 : hour + 12;
  if (hour >= 13 || hour === 0) return hour;
  if (hour === 12) return 12;
  return hour <= 6 ? hour + 12 : hour;
};

/** A day spec as a calendar date, leaning `direction` when it's ambiguous. */
const dayDate = (
  day: DaySpec,
  { now, timeZone, direction }: { now: Date; timeZone: string; direction: TimeDirection },
  laterToday: boolean | null,
) => {
  const today = localDate(now, timeZone);
  if ("offset" in day) return addDays(today, day.offset);
  if ("weekday" in day) {
    const current = wallParts(now.getTime(), timeZone).weekday;
    const ahead = (day.weekday - current + 7) % 7;
    const behind = (current - day.weekday + 7) % 7;
    if (day.modifier === "next") return addDays(today, ahead || 7);
    if (day.modifier === "last") return addDays(today, -(behind || 7));
    if (direction === "future") {
      // Today's weekday is today when the time is still ahead (or there's no time).
      return addDays(today, ahead === 0 && laterToday === false ? 7 : ahead);
    }
    return addDays(today, -(behind === 0 && laterToday === true ? 7 : behind));
  }
  const [year] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = `${year}-${pad(day.month)}-${pad(day.date)}`;
  if (direction === "future" && thisYear < today) return `${year! + 1}-${pad(day.month)}-${pad(day.date)}`;
  if (direction === "past" && thisYear > today) return `${year! - 1}-${pad(day.month)}-${pad(day.date)}`;
  return thisYear;
};

/**
 * The moment a phrase means, read in `timeZone` from `now`. A time of day
 * alone is the most recent one (`past`) or the next (`future`); without
 * am/pm, whichever of the two is nearest that way. A day alone is all day
 * (`allDay`), at the current time of day for `past`. A period ("this
 * evening") without a time is its usual hour.
 */
export const resolveTime = (
  spec: TimeSpec,
  { now, timeZone, direction }: { now: Date; timeZone: string; direction: TimeDirection },
): ResolvedTime => {
  if ("relativeMinutes" in spec)
    return { at: new Date(now.getTime() + spec.relativeMinutes * 60_000), allDay: false };
  const clock = spec.clock ?? (spec.period ? PERIOD_CLOCK[spec.period] : undefined);
  const today = localDate(now, timeZone);

  if (!spec.day) {
    // A time of day alone: the nearest one in the leaning direction.
    const c = clock!;
    const hours =
      c.meridiem || spec.period || c.hour === 0 || c.hour >= 12
        ? [hour24(c, spec.period)]
        : [c.hour, c.hour + 12];
    const candidates = [-1, 0, 1].flatMap((offset) =>
      hours.map((h) => wallTime(addDays(today, offset), h, c.minute, timeZone)),
    );
    const t = now.getTime();
    const sorted = candidates.sort((a, b) => a.getTime() - b.getTime());
    const pick =
      direction === "past"
        ? sorted.filter((d) => d.getTime() <= t).at(-1)
        : sorted.find((d) => d.getTime() > t);
    return { at: pick ?? sorted[1]!, allDay: false };
  }

  const nowMinutes = wallParts(now.getTime(), timeZone).minutes;
  const clockMinutes = clock ? hour24(clock, spec.period) * 60 + clock.minute : null;
  const laterToday = clockMinutes === null ? null : clockMinutes > nowMinutes;
  const date = dayDate(spec.day, { now, timeZone, direction }, laterToday);
  if (clock) return { at: wallTime(date, hour24(clock, spec.period), clock.minute, timeZone), allDay: false };
  if (direction === "past" && date <= today) {
    // "yesterday": that day at this time of day.
    return { at: wallTime(date, Math.floor(nowMinutes / 60), nowMinutes % 60, timeZone), allDay: false };
  }
  return { at: wallTime(date, 0, 0, timeZone), allDay: true };
};

/** Whether a phrase points ahead on its own ("tomorrow", "in 2 hours", "next tue"), whatever the kind. */
export const saysFuture = (spec: TimeSpec) => {
  if ("relativeMinutes" in spec) return spec.relativeMinutes > 0;
  const day = spec.day;
  if (!day) return false;
  if ("offset" in day) return day.offset > 0;
  if ("weekday" in day) return day.modifier === "next";
  return false;
};

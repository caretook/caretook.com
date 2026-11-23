import { addDays, localDate } from "../core/entryTiming";

// Time phrases in quick entry ("at 8am", "30 min ago", "yesterday 9pm",
// "last night", "tue 2pm", "nov 20", "the 25th"), found among a line's words and
// resolved in the recipient's time zone. Pure and client-safe; the parser
// (quickEntry.ts) uses it. English only.

export type Clock = { hour: number; minute: number; meridiem?: "am" | "pm" };
export type DaySpec =
  | { offset: number }
  | { weekday: number; modifier?: "next" | "last" | "this" }
  /** A month and day; `year` only when it was typed ("11/25/26"). */
  | { month: number; date: number; year?: number }
  /** A day of the month alone ("the 25th"): this month's or the next (or last) one that has it. */
  | { date: number };
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

/** When each period has begun: from then until its usual hour, "this morning" can already be now. */
const PERIOD_BEGINS: Record<Period, number> = {
  morning: 4 * 60,
  afternoon: 12 * 60,
  evening: 17 * 60,
  night: 20 * 60,
};

const MINUTE_UNITS = new Set(["m", "min", "mins", "minute", "minutes"]);
const HOUR_UNITS = new Set(["h", "hr", "hrs", "hour", "hours"]);
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, few: 3, couple: 2 };

const meridiemOf = (text: string | undefined): "am" | "pm" | undefined => {
  if (!text) return undefined;
  // A separate "a" or "p" is an ordinary word ("pain 8 a bit better"); "a.m." isn't.
  const t = text.replace(/\./g, "");
  if (t === "am") return "am";
  if (t === "pm") return "pm";
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
    // Joined to the number, one letter is enough ("8a", "8:30p").
    const suffix = withMeridiem[3]!;
    const meridiem = meridiemOf(suffix.length === 1 ? `${suffix}m` : suffix);
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

/** Words after an ordinal that make it a count, not a day of the month ("the 2nd dose"). */
const NOT_A_DATE_AFTER = new Set([
  "dose",
  "doses",
  "time",
  "times",
  "day",
  "days",
  "week",
  "weeks",
  "floor",
  "visit",
  "round",
  "try",
  "attempt",
  "shift",
  "pill",
  "tablet",
]);

/** A day of the month as an ordinal ("25th", "1st"), or null. */
const ordinalDate = (word: string | undefined) => {
  const m = word ? /^(\d{1,2})(st|nd|rd|th)$/.exec(word) : null;
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 31 ? n : null;
};

/** Common fractions: amounts ("gave 1/2 tylenol"), dates only after "on". */
const FRACTIONS = new Set(["1/2", "1/3", "2/3", "1/4", "3/4", "1/8"]);

/**
 * Words that make the slash number before them an amount ("gave 1/8 tsp").
 * The same units as the parser's `AMOUNT_UNITS`, which can't be imported here:
 * the parser imports this file.
 */
const AMOUNT_UNIT_WORDS = new Set(
  "tsp tbsp teaspoon teaspoons tablespoon tablespoons ml mls cc mg mcg g tab tabs tablet tablets pill pills cap caps capsule capsules dose doses drop drops puff puffs unit units patch patches spray sprays sachet sachets inhalation inhalations".split(
    " ",
  ),
);

/**
 * A month/day word, month first ("11/25", "11/25/26", "11/25/2026"), when it
 * is a real day. Without a year, a number out of ten ("3/10", a severity) and
 * a common fraction are dates only after "on", and so is a number right
 * before an amount's unit ("2/5 ml").
 */
const monthDayWord = (word: string | undefined, afterOn: boolean, next: string | undefined) => {
  const m = word ? /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/.exec(word) : null;
  if (!m) return null;
  const month = Number(m[1]);
  const date = Number(m[2]);
  const year = m[3] ? Number(m[3]) + (m[3].length === 2 ? 2000 : 0) : undefined;
  // Without a year, Feb 29 is real: resolving finds the nearest year that has it.
  const longest = month >= 1 && month <= 12 ? new Date(Date.UTC(year ?? 2024, month, 0)).getUTCDate() : 0;
  if (date < 1 || date > longest) return null;
  if (
    year === undefined &&
    !afterOn &&
    (date === 10 || FRACTIONS.has(word!) || AMOUNT_UNIT_WORDS.has(next ?? ""))
  )
    return null;
  return { month, date, ...(year !== undefined && { year }) };
};

const PERIOD_WORDS = new Set(["morning", "afternoon", "evening", "night"]);

/** A clock time starting at word `j`: "2pm", "noon", "2 pm", "at 2", "at 2pm". */
const clockFollows = (words: readonly string[], j: number) => {
  const at = words[j] === "at" ? 1 : 0;
  const first = words[j + at];
  if (!first) return false;
  if (clockWord(first)) return true;
  if (!/^\d{1,2}$/.test(first)) return false;
  const hour = Number(first);
  const meridiem = meridiemOf(words[j + at + 1]);
  return meridiem ? validClock(hour, 0, meridiem) : at === 1 && validClock(hour, 0);
};

const inThePeriod = (words: readonly string[], j: number) =>
  words[j] === "in" && words[j + 1] === "the" && PERIOD_WORDS.has(words[j + 2] ?? "");

/** "sat" and "sun" are also ordinary words; one of these leading words makes them the day. */
const AMBIGUOUS_DAYS = new Set(["sat", "sun"]);
const DAY_LEADS = new Set(["on", "last", "next", "this"]);
/** Who "sat" as a verb: a subject pronoun anywhere, a family word opening the line ("my mom sat"). */
const SAT_PRONOUNS = new Set(["i", "she", "he", "we", "they"]);
const SAT_FAMILY = new Set(["mom", "mum", "dad", "grandma", "grandpa", "husband", "wife", "son", "daughter"]);

/**
 * "o2 sat 95" is oxygen, not Saturday: a short weekday before a bare number, or
 * after "o2", isn't one. "sat up in chair" and "in the sun" aren't days either:
 * "sat" and "sun" need a leading word, a time after them, or the end of the line,
 * and a last "sat" after its subject ("she sat", "mom sat") is the verb.
 */
const notAWeekday = (words: readonly string[], i: number) => {
  const word = words[i]!;
  if (word.length > 5) return false;
  const before = words[i - 1] ?? "";
  if (["o2", "spo2", "oxygen"].includes(before)) return true;
  const next = words[i + 1] ?? "";
  if (/^\d+(\.\d+)?%?$/.test(next) && !meridiemOf(words[i + 2])) return true;
  if (!AMBIGUOUS_DAYS.has(word) || DAY_LEADS.has(before)) return false;
  if (i === words.length - 1) {
    if (before === "the") return true;
    if (word !== "sat") return false;
    const opensLine = i === 1 || (i === 2 && words[0] === "my");
    return SAT_PRONOUNS.has(before) || (opensLine && SAT_FAMILY.has(before));
  }
  return !clockFollows(words, i + 1) && !PERIOD_WORDS.has(next) && !inThePeriod(words, i + 1);
};

/** Words after "at" that aren't a place ("2nd at least", "the 2nd at bedtime"). */
const NOT_A_PLACE = new Set(
  "least most all first last once times bedtime breakfast lunch dinner supper".split(" "),
);

/** Words before an ordinal that make it a count of something ("gave the 2nd", "her 2nd"). */
const COUNTED_AFTER = new Set(
  "gave give given giving took take taking had received receive receiving got my her his their our".split(
    " ",
  ),
);

/** Articles between a count word and its ordinal ("gave a 2nd", "took an 8th"). */
const ARTICLES = new Set(["the", "a", "an"]);

/** "at the clinic", "at kaiser", "at 123 main st": a bare number of one or two digits is no place. */
const placeFollows = (words: readonly string[], j: number) => {
  if (words[j] !== "at") return false;
  const first = words[j + 1];
  return first !== undefined && !NOT_A_PLACE.has(first) && !/^\d{1,2}$/.test(first);
};

/**
 * Whether the ordinal at word `at` can be a day of the month: after "on", at
 * the end of the line, or before a time word or "at" a place. A period word
 * counts only last in the line, so "2nd evening dose" and "2nd night in a row"
 * stay counts.
 */
const ordinalIsADay = (words: readonly string[], at: number, afterOn: boolean) => {
  if (afterOn || at === words.length - 1) return true;
  const next = words[at + 1]!;
  if (clockFollows(words, at + 1) || inThePeriod(words, at + 1)) return true;
  if (next === "at" && words[at + 2] === "night") return true;
  const before = ARTICLES.has(words[at - 1] ?? "") ? words[at - 2] : words[at - 1];
  if (placeFollows(words, at + 1) && !COUNTED_AFTER.has(before ?? "")) return true;
  return PERIOD_WORDS.has(next) && at + 1 === words.length - 1;
};

/**
 * The time phrase among `words` (lowercase, punctuation trimmed), if any:
 * the first of each part (a day, a time of day, minutes ago or ahead) is
 * kept, and the words they took are reported so the parser skips them. With
 * `periodAfterTomorrow`, a bare part of day after "tomorrow" is that part of
 * the day ("tomorrow morning"); only a line asking for something reads it so.
 */
export const findTime = (
  words: readonly string[],
  { periodAfterTomorrow = false } = {},
): FoundTime | null => {
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
        if (periodAfterTomorrow && !period && next && PERIOD_WORDS.has(next)) {
          period = next as Period;
          take(i + 1, 1);
        }
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
      // "11/25", "on 11/10", "11/25/26"
      const slashAt = word === "on" ? i + 1 : i;
      const monthDay = monthDayWord(words[slashAt], word === "on", words[slashAt + 1]);
      if (monthDay) {
        day = monthDay;
        take(i, slashAt - i + 1);
        continue;
      }
      // "25th", "the 25th", "on the 25th", "on 25th"
      const lead = word === "on" && next === "the" ? 2 : word === "on" || word === "the" ? 1 : 0;
      const ordinal = ordinalDate(words[i + lead]);
      const after = words[i + lead + 1] ?? "";
      if (
        ordinal !== null &&
        !NOT_A_DATE_AFTER.has(after) &&
        !(after in MONTHS) &&
        after !== "of" &&
        ordinalIsADay(words, i + lead, word === "on")
      ) {
        day = { date: ordinal };
        take(i, lead + 1);
        continue;
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
        // A zero-padded hour is on the 24-hour clock ("05:00" is 5 AM), not a bare hour.
        else if (!one.meridiem && /^0[1-9]:/.test(first!)) clock = { ...one, meridiem: "am" };
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

/** 24-hour hours for a clock: am/pm as said or as its period implies, else 1–6 are afternoon, 7–11 morning. */
const hour24 = ({ hour, meridiem }: Clock, period?: Period) => {
  if (hour > 12) return hour;
  const pm = meridiem ?? (period === "morning" ? "am" : period ? "pm" : undefined);
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
  const [year, month, date] = today.split("-").map(Number) as [number, number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!("month" in day)) {
    // A day of the month: ahead, this month's unless it has passed (then the
    // next month that has it); back, this month's unless it's still to come.
    const step = direction === "future" ? 1 : -1;
    const passed =
      direction === "future"
        ? day.date < date || (day.date === date && laterToday === false)
        : day.date > date || (day.date === date && laterToday === true);
    let y = year;
    let m = month;
    const move = () => {
      m += step;
      if (m > 12) [y, m] = [y + 1, 1];
      if (m < 1) [y, m] = [y - 1, 12];
    };
    if (passed) move();
    while (day.date > new Date(Date.UTC(y, m, 0)).getUTCDate()) move();
    return `${y}-${pad(m)}-${pad(day.date)}`;
  }
  if (day.year !== undefined) return `${day.year}-${pad(day.month)}-${pad(day.date)}`;
  const thisYear = `${year}-${pad(day.month)}-${pad(day.date)}`;
  const step = direction === "future" ? 1 : -1;
  let y = year;
  if (direction === "future" ? thisYear < today : thisYear > today) y += step;
  // Feb 29: the nearest leap year that way.
  if (day.month === 2 && day.date === 29) while (new Date(Date.UTC(y, 2, 0)).getUTCDate() < 29) y += step;
  return `${y}-${pad(day.month)}-${pad(day.date)}`;
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
    const bare = !c.meridiem && !spec.period && c.hour !== 0 && c.hour < 12;
    // Read forward, a bare hour is never before 7:00: nobody books 2 AM.
    const hours = bare
      ? [c.hour, c.hour + 12].filter((h) => direction === "past" || h >= 7)
      : [hour24(c, spec.period)];
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

/**
 * Whether a period said with no clock, today or with no day ("this morning",
 * "tonight"), has begun while its usual hour is still ahead: what's being
 * logged in it happened by now, not at that hour.
 */
export const periodUnderway = (spec: TimeSpec, { now, timeZone }: { now: Date; timeZone: string }) => {
  if ("relativeMinutes" in spec || spec.clock || !spec.period) return false;
  if (spec.day && !("offset" in spec.day && spec.day.offset === 0)) return false;
  const minutes = wallParts(now.getTime(), timeZone).minutes;
  return minutes >= PERIOD_BEGINS[spec.period] && minutes < PERIOD_CLOCK[spec.period].hour * 60;
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

import type { DaySpec } from "./quickEntryTime";

import { addDays, localDate } from "../core/entryTiming";
import { findTime, resolveTime } from "./quickEntryTime";

// "go to Nov 3", "jump to last Tuesday", "show yesterday": a whole line asking
// to open the timeline on a day. It isn't an assistant action: it saves
// nothing and never reaches the runner or the connector. Anything else on the
// line, or a time of day, leaves it an ordinary log line. Pure and client-safe.

export type GoToDay = {
  /** The calendar day, YYYY-MM-DD, in the viewer's zone. */
  day: string;
  /** After the viewer's today: the timeline can't open there. */
  ahead: boolean;
};

const GO_TO_LINE = /^(?:go to|jump to|show) (.+)$/;
const YEAR_WORD = /^[12]\d{3}$/;

/** A four-digit year closing the words ("nov 3, 2025"), and the words before it without their comma. */
const withoutYear = (words: readonly string[]) => {
  const last = words.at(-1) ?? "";
  if (words.length < 3 || !YEAR_WORD.test(last)) return { words, year: undefined };
  const head = words.slice(0, -1);
  head[head.length - 1] = head.at(-1)!.replace(/,$/, "");
  return { words: head, year: Number(last) };
};

/** The finder accepts "feb 30"; a month's date has to be real, in the year typed (or any leap year). */
const isRealDate = (day: DaySpec) =>
  !("month" in day) ||
  ((day.year === undefined || day.year >= 1000) &&
    day.date <= new Date(Date.UTC(day.year ?? 2024, day.month, 0)).getUTCDate());

/** The day a spec means, reading back from today; "this friday" is the one in the current week. */
const dayOf = (spec: { day: DaySpec }, now: Date, timeZone: string, today: string) => {
  const { day } = spec;
  if ("weekday" in day && day.modifier === "this") {
    const current = new Date(`${today}T12:00:00.000Z`).getUTCDay();
    return addDays(today, day.weekday - current);
  }
  return localDate(resolveTime(spec, { now, timeZone, direction: "past" }).at, timeZone);
};

/**
 * The day a whole line asks to go to, or null. The words after the verb read
 * as if they followed "on" (so "11/10" and "3 Nov" are dates) and every one
 * has to be part of a day, with no clock or part of the day. Read before the
 * line is split, so "go to Nov 3, 2025" stays whole.
 */
export const readGoTo = (
  line: string,
  { now, timeZone }: { now: Date; timeZone: string },
): GoToDay | null => {
  const text = line
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  if (text.includes("\n")) return null;
  const phrase = GO_TO_LINE.exec(text.replace(/\s+/g, " "))?.[1];
  if (!phrase) return null;

  const { words, year } = withoutYear(phrase.split(" "));
  const found = findTime(["on", ...words]);
  if (!found || "relativeMinutes" in found.spec) return null;
  if (!words.every((_, i) => found.used.has(i + 1))) return null;
  const { day: said, clock, period } = found.spec;
  if (!said || clock || period) return null;

  // A year follows a month's name only: not "11/3 2025" or "the 3rd 2025".
  if (year !== undefined && (!("month" in said) || said.year !== undefined || phrase.includes("/")))
    return null;
  const day = year !== undefined && "month" in said ? { ...said, year } : said;
  if (!isRealDate(day)) return null;

  const today = localDate(now, timeZone);
  const key = dayOf({ day }, now, timeZone, today);
  return { day: key, ahead: key > today };
};

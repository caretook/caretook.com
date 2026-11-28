import type { DaySpec } from "./quickEntryTime";

import { addDays, localDate } from "../core/entryTiming";
import { findTime, resolveTime } from "./quickEntryTime";

// Commands: a whole line asking to open a page ("go to meds", "open the
// planner in a new tab") or the timeline on a day ("go to Nov 3", "jump to
// last Tuesday", "show yesterday"). A command isn't an assistant action: it
// saves nothing, runs on the device, and never reaches the runner, the
// connector or recent lines. Anything else on the line, or a time of day,
// leaves it an ordinary log line. Read before the line is split. Pure and
// client-safe; English only.

/** A page a command opens. The app maps each to its URL. */
export type QuickEntryPage =
  | "timeline"
  | "todos"
  | "planner"
  | "medications"
  | "medicationSchedule"
  | "providers"
  | "carePeriods"
  | "profile"
  | "allergies"
  | "settings"
  | "members"
  | "tags"
  | "search";

/**
 * The page names a command takes, matched whole after the verb (and an
 * optional "the", "my" or "our"; a closing "page" is dropped). A name that
 * isn't read is a row here and a test row in quickEntryGoTo.test.ts.
 */
export const QUICK_ENTRY_PAGES: readonly { phrase: string; page: QuickEntryPage }[] = [
  { phrase: "timeline", page: "timeline" },
  { phrase: "todos", page: "todos" },
  { phrase: "to-dos", page: "todos" },
  { phrase: "to dos", page: "todos" },
  { phrase: "todo list", page: "todos" },
  { phrase: "planner", page: "planner" },
  { phrase: "upcoming", page: "planner" },
  { phrase: "calendar", page: "planner" },
  { phrase: "medications", page: "medications" },
  { phrase: "meds", page: "medications" },
  { phrase: "schedule", page: "medicationSchedule" },
  { phrase: "med schedule", page: "medicationSchedule" },
  { phrase: "medication schedule", page: "medicationSchedule" },
  { phrase: "providers", page: "providers" },
  { phrase: "doctors", page: "providers" },
  { phrase: "care periods", page: "carePeriods" },
  { phrase: "profile", page: "profile" },
  { phrase: "allergies", page: "allergies" },
  { phrase: "settings", page: "settings" },
  { phrase: "members", page: "members" },
  { phrase: "tags", page: "tags" },
  { phrase: "search", page: "search" },
];

/**
 * Wording that opens the command in a new tab: closing the line ("open meds
 * in a new tab") or opening it ("pop out the planner", "new tab go to
 * tuesday"), where the verb may be left out.
 */
export const NEW_TAB_PHRASES: readonly { phrase: string; at: "start" | "end" }[] = [
  { phrase: "in a new tab", at: "end" },
  { phrase: "in new tab", at: "end" },
  { phrase: "in a new window", at: "end" },
  { phrase: "new tab", at: "start" },
  { phrase: "pop out", at: "start" },
];

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

/** A line folded for reading: lower case, single spaces, no closing punctuation; null across lines. */
const folded = (line: string) => {
  const text = line
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  return text.includes("\n") ? null : text.replace(/\s+/g, " ");
};

/**
 * The day words name, or null. They read as if they followed "on" (so "11/10"
 * and "3 Nov" are dates) and every one has to be part of a day, with no clock
 * or part of the day.
 */
const dayFrom = (phrase: string, { now, timeZone }: { now: Date; timeZone: string }): GoToDay | null => {
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

/**
 * The day a whole line asks to go to, or null. Read before the line is split,
 * so "go to Nov 3, 2025" stays whole. `readCommand` reads this and more.
 */
export const readGoTo = (line: string, context: { now: Date; timeZone: string }): GoToDay | null => {
  const text = folded(line);
  const phrase = text === null ? undefined : GO_TO_LINE.exec(text)?.[1];
  return phrase ? dayFrom(phrase, context) : null;
};

/** A whole line that opens a page or the timeline on a day, here or in a new tab. */
export type QuickEntryCommand =
  ({ kind: "day"; newTab: boolean } & GoToDay) | { kind: "page"; page: QuickEntryPage; newTab: boolean };

const COMMAND_VERB = /^(go to|jump to|open|show) (.+)$/;
/** "open" takes a page only: "open wound looks better" is a note, and no day reads "open". */
const DAY_VERBS = new Set(["go to", "jump to", "show"]);
const PAGE_LEAD = /^(?:the|my|our) /;
const PAGE_TAIL = / page$/;

/** The line without its new-tab wording, and whether it had some. */
const withoutNewTab = (text: string) => {
  for (const { phrase, at } of NEW_TAB_PHRASES) {
    if (at === "end" && text.endsWith(` ${phrase}`))
      return { rest: text.slice(0, -phrase.length - 1), newTab: true };
    if (at === "start" && text.startsWith(`${phrase} `))
      return { rest: text.slice(phrase.length + 1), newTab: true };
  }
  return { rest: text, newTab: false };
};

const pageOf = (words: string) => {
  const name = words.replace(PAGE_LEAD, "").replace(PAGE_TAIL, "");
  return QUICK_ENTRY_PAGES.find((row) => row.phrase === name)?.page ?? null;
};

/**
 * The command a whole line is, or null: go to, jump to, open or show (left
 * out after opening new-tab wording) plus a page from `QUICK_ENTRY_PAGES`, or
 * a day as `readGoTo` reads it (not after "open"). Read before the line is
 * split; null leaves it an ordinary line.
 */
export const readCommand = (
  line: string,
  context: { now: Date; timeZone: string },
): QuickEntryCommand | null => {
  const text = folded(line);
  if (!text) return null;
  const { rest, newTab } = withoutNewTab(text);
  const said = COMMAND_VERB.exec(rest);
  const verb = said?.[1];
  const target = said?.[2] ?? (newTab ? rest : undefined);
  if (!target) return null;

  const page = pageOf(target);
  if (page) return { kind: "page", page, newTab };
  if (verb !== undefined && !DAY_VERBS.has(verb)) return null;
  const day = dayFrom(target, context);
  return day ? { kind: "day", ...day, newTab } : null;
};

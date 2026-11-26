import type { PrintMedicationInput, PrintRecipient } from "../printSheet";
import type { SchedulePass } from "../../../../../../lib/medications/medicationDisplay";

import { slotAmount, slotTimes, sortPasses } from "@caretook/data/schema";
import { clockTime, FORM_LABELS, medicationTitle } from "../../../../../../lib/medications/medicationDisplay";
import { addDays, dayIn, printSheet } from "../printSheet";

// The weekly bedside sheet's view model: one week in the recipient's zone, a
// row per pass and medication with a box per day, then blank rows for
// as-needed medications. Pure: no React or database here; web:unit tests it,
// and the print page renders it from the device's local copy (so it works
// offline). Imports are relative so web:unit can load it without Vite.

/** Blank rows each as-needed medication gets, with room for the time and initials. */
export const AS_NEEDED_LINES = 2;

/**
 * The marks in each dose box, one per answered dose state in the app: circle
 * or tick one. In their own boxes, in this order, so a photo of the sheet
 * reads back as the app's states. The sheet's legend says what each means.
 */
export const DOSE_MARKS = [
  { mark: "G", state: "given", label: "Given" },
  { mark: "S", state: "skipped", label: "Skipped" },
  { mark: "R", state: "refused", label: "Refused" },
] as const;

/** The URL parameter for the week's first day ("YYYY-MM-DD"). */
export const WEEK_START_PARAM = "start";

/** One medication in one pass (or at one time of its own): a row of seven boxes. */
export type WeeklyRow = {
  /** Unique on the sheet: the group's key and the medication. */
  key: string;
  medicationId: string;
  /** "Lisinopril 10 mg". */
  title: string;
  form: string | null;
  /** What's given then: the slot's amount, else the usual dose; null when neither is set. */
  amount: string | null;
};

/** A pass, or a time of its own (a pass of one), with its medications by name. */
export type WeeklyGroup = {
  /** `pass:<id>` or `time:HH:MM`. */
  key: string;
  /** The pass's name; null for a time of its own. */
  name: string | null;
  /** "8:00", "21:00". */
  time: string;
  rows: WeeklyRow[];
};

/** An as-needed medication: blank rows to write the time and initials in. */
export type WeeklyAsNeeded = {
  medicationId: string;
  title: string;
  form: string | null;
  amount: string | null;
  /** "Up to 4 a day", or null without a limit. */
  limit: string | null;
  lines: number;
};

export type WeeklyDay = {
  /** "YYYY-MM-DD". */
  day: string;
  /** "Mon". */
  weekday: string;
  /** "Nov 16". */
  date: string;
};

export type WeeklySheet = {
  recipient: { name: string; dateOfBirth: string | null };
  groupName: string;
  /** The recipient's day when printed: "Nov 18, 2026". */
  printedOn: string;
  /** The week's first day, "YYYY-MM-DD". */
  start: string;
  /** "Nov 16 – 22, 2026", "Oct 26 – Nov 1, 2026", "Dec 28, 2026 – Jan 3, 2027". */
  label: string;
  days: WeeklyDay[];
  groups: WeeklyGroup[];
  asNeeded: WeeklyAsNeeded[];
  /** The week before and after, and this week (its Monday in the recipient's zone). */
  previousStart: string;
  nextStart: string;
  thisWeekStart: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day "YYYY-MM-DD", else null (an unknown or malformed `?start=`). */
export const parseWeekStart = (value: string | null | undefined): string | null => {
  if (!value || !DAY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
};

/** 0 for Monday … 6 for Sunday: a calendar day's weekday, the same in every zone. */
const mondayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

/** The Monday of the week `now` is in, in `timeZone` (the device's when it's missing or unknown). */
export const thisWeekStart = (now: Date, timeZone: string | null | undefined) => {
  const today = dayIn(now, timeZone);
  return addDays(today, -mondayIndex(today));
};

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const format = (day: string, options: Intl.DateTimeFormatOptions, locale?: string) =>
  new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(utc(day));

/** "Nov 16 – 22, 2026", across a month "Oct 26 – Nov 1, 2026", across a year with both years. */
export const weekLabel = (start: string, locale?: string) => {
  const end = addDays(start, 6);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const monthDay = (day: string) => format(day, { month: "short", day: "numeric" }, locale);
  const year = (day: string) => day.slice(0, 4);
  if (sameMonth) return `${monthDay(start)} – ${format(end, { day: "numeric" }, locale)}, ${year(end)}`;
  if (sameYear) return `${monthDay(start)} – ${monthDay(end)}, ${year(end)}`;
  return `${monthDay(start)}, ${year(start)} – ${monthDay(end)}, ${year(end)}`;
};

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const blank = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

/**
 * The weekly sheet for a group's current medications:
 *
 * - seven days from `weekStart` (else this week's Monday in the recipient's
 *   zone): calendar days, so a clock change inside the week changes nothing;
 * - a group per pass that has medications, in the passes' order, then one per
 *   time of its own, by time; in each, its medications by name, with the
 *   slot's amount (else the usual dose);
 * - each as-needed medication, by name, with `AS_NEEDED_LINES` blank rows.
 *
 * Stopped and deleted medications are left out, and a slot in a pass this
 * device doesn't know. `locale` is for tests; screens pass none.
 */
export const weeklySheet = ({
  recipient,
  groupName = "",
  medications,
  passes = [],
  weekStart,
  now,
  locale,
}: {
  recipient: PrintRecipient | null;
  groupName?: string;
  medications: readonly PrintMedicationInput[];
  /** The group's passes, deleted ones too (a schedule naming one keeps its name and time). */
  passes?: readonly SchedulePass[];
  /** "YYYY-MM-DD"; null or unknown is this week. */
  weekStart?: string | null;
  now: Date;
  locale?: string;
}): WeeklySheet => {
  // The header (name, date of birth, day printed) reads as the medication list's does.
  const header = printSheet({ recipient, groupName, medications: [], providers: [], now, locale });
  const current = parseWeekStart(weekStart ?? null) ?? thisWeekStart(now, recipient?.timeZone);
  const thisWeek = thisWeekStart(now, recipient?.timeZone);

  const days: WeeklyDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(current, i);
    return {
      day,
      weekday: format(day, { weekday: "short" }, locale),
      date: format(day, { month: "short", day: "numeric" }, locale),
    };
  });

  const live = medications.filter((m) => !m.deletedAt && m.status === "current").sort(byName);
  const passOrder = new Map(sortPasses(passes).map((p, i) => [p.id, { pass: p, index: i }]));

  const groups = new Map<string, WeeklyGroup & { order: [number, string] }>();
  for (const m of live) {
    for (const slot of slotTimes(m.schedule, passes)) {
      const known = slot.passId ? passOrder.get(slot.passId) : undefined;
      const key = known ? `pass:${known.pass.id}` : `time:${slot.time}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          name: known ? known.pass.name : null,
          time: clockTime(slot.time),
          rows: [],
          // Passes first in their order, then times of their own by time.
          order: known ? [known.index, ""] : [Number.MAX_SAFE_INTEGER, slot.time],
        };
        groups.set(key, group);
      }
      if (group.rows.some((r) => r.medicationId === m.id)) continue;
      group.rows.push({
        key: `${key}:${m.id}`,
        medicationId: m.id,
        title: medicationTitle(m),
        form: m.form ? FORM_LABELS[m.form] : null,
        amount: slotAmount(m, slot),
      });
    }
  }

  const asNeeded: WeeklyAsNeeded[] = live.flatMap((m) =>
    m.schedule.type === "asNeeded"
      ? [
          {
            medicationId: m.id,
            title: medicationTitle(m),
            form: m.form ? FORM_LABELS[m.form] : null,
            amount: blank(m.dose),
            limit: m.schedule.maxPerDay ? `Up to ${m.schedule.maxPerDay} a day` : null,
            lines: AS_NEEDED_LINES,
          },
        ]
      : [],
  );

  return {
    recipient: header.recipient,
    groupName: header.groupName,
    printedOn: header.printedOn,
    start: current,
    label: weekLabel(current, locale),
    days,
    groups: [...groups.values()]
      .sort((a, b) => a.order[0] - b.order[0] || a.order[1].localeCompare(b.order[1]))
      .map(({ order: _order, ...group }) => group),
    asNeeded,
    previousStart: addDays(current, -7),
    nextStart: addDays(current, 7),
    thisWeekStart: thisWeek,
  };
};

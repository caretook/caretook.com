import type { MonthWeek, RepeatFreq, RepeatRule, Weekday } from "@caretook/data/schema";
import type { Schedule } from "./entrySchedule";

import {
  addDays,
  dayInZone,
  localDate,
  ordinal,
  timeInZone,
  WEEKDAYS,
  weekdayName,
} from "@caretook/data/schema";

// The repeat field's choices (appointments-2): what the sheet's controls
// hold, the rule they make, and a draft's timing as a series takes it. Pure;
// web:unit tests it. Expanding a rule (the preview) is rrule's, loaded with
// the field itself.

/** The field's first control: Doesn't repeat, Daily, Weekly, Monthly, or Custom (every N …). */
export const REPEAT_PRESETS = ["none", "daily", "weekly", "monthly", "custom"] as const;
export type RepeatPreset = (typeof REPEAT_PRESETS)[number];

export const PRESET_LABELS: Record<RepeatPreset, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const UNIT_LABELS: Record<RepeatFreq, { one: string; many: string }> = {
  daily: { one: "day", many: "days" },
  weekly: { one: "week", many: "weeks" },
  monthly: { one: "month", many: "months" },
};

export type RepeatEndChoice = "never" | "on" | "after";

export type RepeatChoice = {
  preset: RepeatPreset;
  /** Custom only: every `interval` `unit`s. The presets repeat every 1. */
  interval: number;
  unit: RepeatFreq;
  /** Weekly: the days. */
  weekdays: Weekday[];
  /** Monthly: on the start's date (the 18th), or its weekday in the month (the 3rd Wednesday). */
  monthlyBy: "date" | "weekday";
  end: RepeatEndChoice;
  /** "YYYY-MM-DD", for `end: "on"`. */
  until: string;
  /** For `end: "after"`. */
  count: number;
};

/** The weekday of a local day ("YYYY-MM-DD"). */
export const weekdayOf = (day: string): Weekday => {
  const [y, m, d] = day.split("-").map(Number);
  const js = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(js + 6) % 7]!;
};

/** A day's week in its month: 1st to 4th, or the last (a 5th week counts as the last). */
export const monthWeekOf = (day: string): MonthWeek => {
  const date = Number(day.slice(8, 10));
  const nth = Math.ceil(date / 7);
  return nth >= 5 ? -1 : (nth as MonthWeek);
};

/** The monthly options for a first day: "On the 18th", "On the 3rd Wednesday". */
export const monthlyLabels = (startsOn: string) => {
  const week = monthWeekOf(startsOn);
  return {
    date: `On the ${ordinal(Number(startsOn.slice(8, 10)))}`,
    weekday: `On the ${week === -1 ? "last" : ordinal(week)} ${weekdayName(weekdayOf(startsOn))}`,
  };
};

/** Where the field starts: no repeat, but weekly on the first day's weekday if picked, ending in three months or after 10. */
export const defaultChoice = (startsOn: string): RepeatChoice => ({
  preset: "none",
  interval: 1,
  unit: "weekly",
  weekdays: [weekdayOf(startsOn)],
  monthlyBy: "date",
  end: "never",
  until: addDays(startsOn, 91),
  count: 10,
});

/** The rule a choice makes, or null for Doesn't repeat. Weekly with no days is left for the rule check to refuse. */
export const choiceRule = (choice: RepeatChoice, startsOn: string): RepeatRule | null => {
  if (choice.preset === "none") return null;
  const freq: RepeatFreq = choice.preset === "custom" ? choice.unit : choice.preset;
  const interval = choice.preset === "custom" ? Math.max(1, Math.trunc(choice.interval) || 1) : 1;
  return {
    freq,
    interval,
    weekdays: freq === "weekly" ? WEEKDAYS.filter((d) => choice.weekdays.includes(d)) : [],
    monthly:
      freq !== "monthly"
        ? null
        : choice.monthlyBy === "date"
          ? { by: "date", day: Number(startsOn.slice(8, 10)) }
          : { by: "weekday", nth: monthWeekOf(startsOn), weekday: weekdayOf(startsOn) },
    end:
      choice.end === "on"
        ? { type: "on", until: choice.until }
        : choice.end === "after"
          ? { type: "after", count: Math.trunc(choice.count) }
          : { type: "never" },
  };
};

/** The weekdays toggle, keeping at least the one being turned on. */
export const toggleWeekday = (choice: RepeatChoice, day: Weekday): RepeatChoice => ({
  ...choice,
  weekdays: choice.weekdays.includes(day)
    ? choice.weekdays.filter((d) => d !== day)
    : [...choice.weekdays, day],
});

/** What a series takes from a draft's schedule: its first day and time in the recipient's zone, and its length. */
export const draftTiming = (
  schedule: Schedule,
  { entryTimeZone, recipientTimeZone }: { entryTimeZone: string; recipientTimeZone: string },
) => {
  const start = new Date(schedule.occurredAt);
  if (schedule.allDay) {
    // An all-day item's day is in its own zone.
    return {
      startsOn: localDate(schedule.occurredAt, entryTimeZone),
      startTime: null,
      allDay: true,
      timeZone: recipientTimeZone,
      durationMinutes: null,
    };
  }
  const minutes = schedule.endsAt
    ? Math.round((new Date(schedule.endsAt).getTime() - start.getTime()) / 60_000)
    : null;
  return {
    startsOn: dayInZone(start, recipientTimeZone),
    startTime: timeInZone(start, recipientTimeZone),
    allDay: false,
    timeZone: recipientTimeZone,
    durationMinutes: minutes && minutes > 0 ? minutes : null,
  };
};

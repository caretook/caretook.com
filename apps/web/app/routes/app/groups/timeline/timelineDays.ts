import { dayLabel } from "../../../../lib/format";

// The timeline's day sections. Pure, so web:unit tests it.

/** One day's section: its key (`day-<key>` ids), heading and entries, in list order. */
export type TimelineDay<T> = { key: string; label: string; entries: T[] };

/** A stable key for an instant's calendar day in `timeZone`: "2026-11-17". */
export const dayKeyIn = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone });

/**
 * Consecutive entries grouped by calendar day in `timeZone` (the viewer's),
 * labelled by `dayLabel` ("Today", "Yesterday", "Monday, Nov 16"). The list
 * is already in time order, so a day that comes back later (an entry out of
 * order) starts a new section rather than reordering anything.
 */
export const groupByDay = <T extends { occurredAt: string }>(
  entries: T[],
  timeZone: string,
  now: Date,
  locale?: string,
): TimelineDay<T>[] => {
  const days: TimelineDay<T>[] = [];
  for (const entry of entries) {
    const key = dayKeyIn(entry.occurredAt, timeZone);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: dayLabel(entry.occurredAt, timeZone, now, locale), entries: [entry] });
  }
  return days;
};

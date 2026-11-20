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

/** One row of a day section: an entry, or a care period's boundary marker. */
export type TimelineItem<E, M> =
  | { type: "entry"; key: string; occurredAt: string; entry: E }
  | { type: "marker"; key: string; occurredAt: string; marker: M };

/**
 * The day sections with the boundary markers placed at their moments
 * (`lib/periodMarkers` picks which). Both lists are newest first. An entry
 * at a marker's exact moment is in the new period, so it sits above the
 * marker. A day with only a marker gets its own section.
 */
export const withMarkers = <
  E extends { id: string; occurredAt: string },
  M extends { id: string; at: string },
>(
  days: TimelineDay<E>[],
  markers: readonly M[],
  timeZone: string,
  now: Date,
  locale?: string,
): TimelineDay<TimelineItem<E, M>>[] => {
  const entries = days.flatMap((d) => d.entries);
  const items: TimelineItem<E, M>[] = [];
  const asMarker = (marker: M): TimelineItem<E, M> => ({
    type: "marker",
    key: `marker-${marker.id}`,
    occurredAt: marker.at,
    marker,
  });
  let m = 0;
  for (const entry of entries) {
    const at = new Date(entry.occurredAt).getTime();
    while (m < markers.length && new Date(markers[m]!.at).getTime() > at) items.push(asMarker(markers[m++]!));
    items.push({ type: "entry", key: entry.id, occurredAt: entry.occurredAt, entry });
  }
  while (m < markers.length) items.push(asMarker(markers[m++]!));
  return groupByDay(items, timeZone, now, locale);
};

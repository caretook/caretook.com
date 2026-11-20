import type { TimedEntry } from "./upcoming";

import { localDate } from "@caretook/data/schema";
import { dayLabel } from "../core/format";
import { entryTiming, upcomingOrder } from "./upcoming";

// Upcoming's and the Past tab's sections, and the timeline's Upcoming block. Pure, so web:unit tests it.

/** One section: its key (`day-<key>` ids), heading and items, in list order. */
export type UpcomingSection<T> = { key: string; label: string; items: T[] };

/** The section for items in progress, above every day. */
export const NOW_KEY = "now";

/**
 * The day an item is listed under: an all-day item's own day (in its own
 * zone, where its day was chosen); a timed one's day where the viewer is.
 */
const dayOf = (item: TimedEntry, viewerZone: string) => {
  const zone = item.allDay ? item.timeZone : viewerZone;
  return { key: localDate(item.occurredAt, zone), zone };
};

/**
 * Upcoming, in sections: items in progress first ("Now"), then a section per
 * day, soonest first ("Today", "Tomorrow", "Friday, Nov 27"), all-day items
 * first in their day (`upcomingOrder`). Past items are left out, so as `now`
 * moves on, they leave without new rows. A cancelled item is never "Now": it
 * stays in its day, struck through, until it's past.
 */
export const upcomingSections = <T extends TimedEntry>(
  items: readonly T[],
  now: Date,
  viewerZone: string,
  locale?: string,
): UpcomingSection<T>[] => {
  const inProgress: T[] = [];
  const ahead: T[] = [];
  for (const item of items) {
    const timing = entryTiming(item, now);
    if (timing === "now" && !item.cancelledAt) inProgress.push(item);
    else if (timing !== "past") ahead.push(item);
  }
  const sections: UpcomingSection<T>[] = [];
  if (inProgress.length > 0) {
    sections.push({ key: NOW_KEY, label: "Now", items: inProgress.sort(upcomingOrder) });
  }
  const byDay = new Map<string, UpcomingSection<T>>();
  for (const item of ahead.sort(upcomingOrder)) {
    const { key, zone } = dayOf(item, viewerZone);
    const section = byDay.get(key);
    if (section) section.items.push(item);
    else {
      const next = { key, label: dayLabel(item.occurredAt, zone, now, locale), items: [item] };
      byDay.set(key, next);
      sections.push(next);
    }
  }
  return sections;
};

/**
 * The Past tab, in sections: past items only (one in progress, or an
 * all-day item today, is still in Upcoming), newest first as given, a
 * section per day in the viewer's zone ("Today", "Yesterday", "Monday, Nov 16").
 */
export const pastSections = <T extends TimedEntry>(
  items: readonly T[],
  now: Date,
  viewerZone: string,
  locale?: string,
): UpcomingSection<T>[] => {
  const sections: UpcomingSection<T>[] = [];
  const byDay = new Map<string, UpcomingSection<T>>();
  for (const item of items) {
    if (entryTiming(item, now) !== "past") continue;
    const { key, zone } = dayOf(item, viewerZone);
    const section = byDay.get(key);
    if (section) section.items.push(item);
    else {
      const next = { key, label: dayLabel(item.occurredAt, zone, now, locale), items: [item] };
      byDay.set(key, next);
      sections.push(next);
    }
  }
  return sections;
};

/** How many items the timeline's Upcoming block shows before "See all in Upcoming". */
export const UPCOMING_BLOCK_LIMIT = 5;

/**
 * The first `limit` items of `sections`, in order, keeping their sections
 * (a section past the limit is left out), and how many items there were in all.
 */
export const firstItems = <T>(sections: readonly UpcomingSection<T>[], limit: number) => {
  const out: UpcomingSection<T>[] = [];
  let left = limit;
  let total = 0;
  for (const section of sections) {
    total += section.items.length;
    if (left <= 0) continue;
    const items = section.items.slice(0, left);
    left -= items.length;
    out.push({ ...section, items });
  }
  return { sections: out, total };
};

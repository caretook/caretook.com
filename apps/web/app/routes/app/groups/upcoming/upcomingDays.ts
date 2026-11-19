import type { TimedEntry } from "../../../../lib/upcoming";

import { localDate } from "@caretook/data/schema";
import { dayLabel } from "../../../../lib/format";
import { entryTiming, upcomingOrder } from "../../../../lib/upcoming";

// Upcoming's and the Past tab's sections. Pure, so web:unit tests it.

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
 * moves on, they leave without new rows.
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
    if (timing === "now") inProgress.push(item);
    else if (timing === "upcoming") ahead.push(item);
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

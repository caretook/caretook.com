import type { ShareLevel } from "@caretook/data/schema";

import ical, { ICalEventStatus } from "ical-generator";
import type { CalendarItem } from "@caretook/data/domain";
import { calendarText } from "@caretook/data/domain";

// The iCal feed's rendering (appointments-2, slice 5): `CalendarItem`s to a
// VCALENDAR over ical-generator, server only. Timed items are in UTC, all-day
// items DATE values (the end exclusive, as iCal wants), a cancelled
// appointment carries STATUS:CANCELLED, and every item, a series visit
// included, is its own VEVENT with no RRULE. The UID is the item's uid at
// our domain, so a calendar app keeps one event per item as it moves. The
// words are `calendarText`'s, at the level asked for: generic text has no
// title, place or provider.

export type IcsOptions = {
  /** The calendar's name ("Caretook: Pat"). */
  calendarName: string;
  /** The app's origin (`APP_URL`): the UIDs' domain. */
  appUrl: string;
  /** When it's rendered (DTSTAMP). */
  now?: Date;
};

/** How often subscribing calendars are asked to refresh, in seconds. */
export const FEED_REFRESH_SECONDS = 3600;

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

export const renderIcs = (items: readonly CalendarItem[], level: ShareLevel, options: IcsOptions) => {
  const stamp = options.now ?? new Date();
  const domain = new URL(options.appUrl).hostname;
  const calendar = ical({
    name: options.calendarName,
    prodId: { company: "caretook.com", product: "caretook", language: "EN" },
    ttl: FEED_REFRESH_SECONDS,
  });

  for (const item of items) {
    const text = calendarText(item, level);
    calendar.createEvent({
      id: `${item.uid}@${domain}`,
      stamp,
      allDay: item.allDay,
      start: item.allDay ? dayDate(item.start) : new Date(item.start),
      end: item.allDay ? dayDate(item.end) : new Date(item.end),
      summary: text.summary,
      description: text.description,
      location: text.location,
      url: item.appUrl,
      status: item.status === "cancelled" ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
    });
  }
  return calendar.toString();
};

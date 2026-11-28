import type { ShareLevel } from "../db/schema";
import type { GoogleEventInput } from "./client";

import { createHash } from "node:crypto";
import { STATUS_PROPERTY, UID_PROPERTY } from "./client";
import type { CalendarItem } from "../domain/calendars/calendarItems";
import { calendarText } from "../domain/calendars/calendarText";

// What a push to one member's Google calendar does (appointments-2, slice
// 7), pure: each calendar item as the event it should be, at the member's
// share level, and against what was pushed last (by hash) the events to
// write and the ones to delete. An unchanged item makes no call.

/**
 * The Google event id for an item: base32hex (Google's alphabet, a–v and
 * 0–9), stable per item, so a repeated write replaces rather than adds.
 */
export const googleEventId = (uid: string) =>
  `ct${createHash("sha256").update(uid).digest("hex").slice(0, 40)}`;

/** The event an item becomes at `level`: generic text by default, never note content. */
export const toGoogleEvent = (item: CalendarItem, level: ShareLevel): GoogleEventInput => {
  const text = calendarText(item, level);
  const cancelled = item.status === "cancelled";
  return {
    id: googleEventId(item.uid),
    summary: text.summary,
    description: text.description,
    location: text.location,
    start: item.allDay ? { date: item.start } : { dateTime: item.start, timeZone: item.timeZone },
    end: item.allDay ? { date: item.end } : { dateTime: item.end, timeZone: item.timeZone },
    // A cancelled appointment stays in the calendar, marked ("Cancelled: …"), and shows as free.
    transparency: cancelled ? "transparent" : "opaque",
    privateProperties: { [UID_PROPERTY]: item.uid, [STATUS_PROPERTY]: item.status },
  };
};

/** A stable hash of what we'd send: the same event always hashes the same. */
export const eventHash = (event: GoogleEventInput) => {
  const sorted = (value: unknown): unknown =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
        )
      : value;
  return createHash("sha256")
    .update(JSON.stringify(sorted(event)))
    .digest("hex");
};

/** What was pushed for an item last time (a `google_event_link`). */
export type PushedLink = { itemUid: string; googleEventId: string; pushedHash: string };

export type PushPlan = {
  /** Items new or changed since the last push, with the event and its hash. */
  upserts: { uid: string; event: GoogleEventInput; hash: string }[];
  /** Links whose item left the window or was deleted (or a todo done): delete the event. */
  deletes: PushedLink[];
  /** Items whose event is already as pushed. */
  unchanged: number;
};

/** Diff `items` (at `level`) against what's been pushed (`links`). */
export const planPush = ({
  items,
  links,
  level,
}: {
  items: readonly CalendarItem[];
  links: readonly PushedLink[];
  level: ShareLevel;
}): PushPlan => {
  const pushed = new Map(links.map((link) => [link.itemUid, link]));
  const plan: PushPlan = { upserts: [], deletes: [], unchanged: 0 };
  const current = new Set<string>();
  for (const item of items) {
    current.add(item.uid);
    const link = pushed.get(item.uid);
    // An event made in Google and taken in (slice 9) keeps Google's id.
    const event = { ...toGoogleEvent(item, level), ...(link && { id: link.googleEventId }) };
    const hash = eventHash(event);
    if (link?.pushedHash === hash) plan.unchanged++;
    else plan.upserts.push({ uid: item.uid, event, hash });
  }
  for (const link of links) if (!current.has(link.itemUid)) plan.deletes.push(link);
  return plan;
};

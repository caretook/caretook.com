import type { EntryFilters, LocalQuery } from "../../../../lib/sync/timeline";

import { pastEventsWindow, upcomingWindow } from "../../../../lib/sync/timeline";
import { contactsQuery } from "./upcomingContact";

// Upcoming's and the Past tab's local queries, built on `lib/sync/timeline`'s
// windows (which share the timeline's filter conditions). Pure, so web:unit
// tests them.

const MINUTE_MS = 60_000;

/**
 * The moment Upcoming's window is built from: `now` rounded down to the
 * minute, so the live query changes once a minute, not on every tick. The
 * window then holds a little more than what's upcoming at `now` (items that
 * passed within the minute), and the screen filters those out by the live
 * clock (`upcomingSections`).
 */
export const windowStart = (now: Date | number) =>
  new Date(Math.floor(new Date(now).getTime() / MINUTE_MS) * MINUTE_MS);

/** Upcoming's entries and their linked providers, for one window. */
export const upcomingQueries = (
  groupId: string,
  filters: EntryFilters,
  now: Date | number,
): { entries: LocalQuery; contacts: LocalQuery } => {
  const window = upcomingWindow(groupId, filters, windowStart(now));
  return {
    entries: { sql: `SELECT * ${window.sql}`, params: window.params },
    contacts: contactsQuery(window),
  };
};

/** The Past tab's events (newest first, one more than `limit`) and their linked providers. */
export const pastQueries = (
  groupId: string,
  filters: EntryFilters,
  limit: number,
  cutoff: string,
): { entries: LocalQuery; contacts: LocalQuery } => {
  const window = pastEventsWindow(groupId, filters, limit, cutoff);
  return {
    entries: { sql: `SELECT * ${window.sql}`, params: window.params },
    contacts: contactsQuery(window),
  };
};

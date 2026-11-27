import type { EntryCondition, EntryFilters, LocalQuery } from "../../../../lib/timeline/timeline.sync";

import { matchesText, textTokens } from "../../../../lib/core/textFilter";
import { windowDocumentsQuery } from "../../../../lib/live-notes/notes.sync";
import {
  pastEventsFrom,
  pastEventsWindow,
  UPCOMING_HORIZON_DAYS,
  upcomingWindow,
} from "../../../../lib/timeline/timeline.sync";
import { contactsQuery } from "./upcomingContact";

// The Planner and Past tabs' local queries, built on `lib/timeline/timeline.sync`'s
// windows (which share the timeline's filter conditions). Pure, so web:unit
// tests them.

const DAY_MS = 86_400_000;

/**
 * The moment the Planner tab's window is built from: the start of `now`'s UTC
 * day, so the live query changes once a day, never on the clock's 30 s tick
 * (B-910). The window then holds a little more than what's upcoming at `now`
 * (items that passed earlier that day), and the screen splits them by the
 * live clock (`upcomingSections`); its far end is a day further out, and
 * `inUpcomingHorizon` keeps the horizon at `now`'s.
 */
export const windowStart = (now: Date | number) =>
  new Date(Math.floor(new Date(now).getTime() / DAY_MS) * DAY_MS);

/** The Planner tab's entries, their linked providers and their documents (the previews), for one window. */
export const upcomingQueries = (
  groupId: string,
  filters: EntryFilters,
  now: Date | number,
): { entries: LocalQuery; contacts: LocalQuery; documents: LocalQuery } => {
  const window = upcomingWindow(groupId, filters, windowStart(now), UPCOMING_HORIZON_DAYS + 1);
  return {
    entries: { sql: `SELECT * ${window.sql}`, params: window.params },
    contacts: contactsQuery(window),
    documents: windowDocumentsQuery(groupId, window),
  };
};

/** True while an entry starts within Upcoming's horizon from `now` (the window reads a day more). */
export const inUpcomingHorizon = (entry: { occurredAt: string }, now: Date | number) =>
  new Date(entry.occurredAt).getTime() < new Date(now).getTime() + UPCOMING_HORIZON_DAYS * DAY_MS;

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

/** A past event's own text for the search box: its title and place (its document's text is the preview). */
export type PastTextRow = { id: string; title: string | null; place: string | null };

/**
 * Every past event under the other filters (uncapped: the text filter
 * searches all of them, not the loaded page), with its text.
 */
export const pastTextQuery = (groupId: string, filters: EntryFilters, cutoff: string): LocalQuery => {
  const from = pastEventsFrom(groupId, { ...filters, match: null }, cutoff);
  return { sql: `SELECT id, title, place ${from.sql}`, params: from.params };
};

/**
 * The documents of every past event `pastTextQuery` reads (the search box
 * matches their text, and the page's previews are among them): events only,
 * never the group's notes or what's ahead.
 */
export const pastDocumentsQuery = (groupId: string, filters: EntryFilters, cutoff: string): LocalQuery =>
  windowDocumentsQuery(groupId, pastEventsFrom(groupId, { ...filters, match: null }, cutoff));

/**
 * The Past window's condition for the search box's text `q`: the events
 * whose title, place or document text (`previews`, by entry id) has every
 * word typed (`matchesText`: case and accents ignored), or null without text.
 * The ids go to the local SQL query, so paging counts only the matches.
 */
export const pastTextCondition = (
  rows: readonly PastTextRow[],
  previews: ReadonlyMap<string, string>,
  q: string,
): EntryCondition | null => {
  const tokens = textTokens(q);
  if (tokens.length === 0) return null;
  const ids = rows.filter((r) => matchesText(tokens, r.title, r.place, previews.get(r.id))).map((r) => r.id);
  return { sql: "timeline_entry.id IN (SELECT value FROM json_each(?))", params: [JSON.stringify(ids)] };
};

/** A rescheduled event's new one: its id and start (local text). */
export type RescheduledTargetRow = { id: string; occurred_at: string | null };

/**
 * The group's events that others were rescheduled to (not deleted), for
 * "Rescheduled to …": the new event may be outside the list's window (a
 * past event rescheduled to next week), so it's looked up on its own.
 */
export const rescheduledTargetsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT id, occurred_at FROM timeline_entry
        WHERE group_id = ? AND deleted_at IS NULL
          AND id IN (SELECT rescheduled_to FROM timeline_entry WHERE group_id = ? AND rescheduled_to IS NOT NULL)`,
  params: [groupId, groupId],
});

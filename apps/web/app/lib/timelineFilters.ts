import type { TimelineEntryKind } from "@caretook/data/schema";

import { SEARCH_MAX_LENGTH } from "@caretook/data/schema";

// The timeline's filters live in the URL: `?kind=<kind>&author=<userId>`
// and the search `?q=<text>` (narrowed to one care period by `?period=<id>`
// while it's on), plus the Upcoming block's switch (`?upcoming=1`), kept with them.
// This module owns that state: reading it from a search string, and the
// search string for each change. No React or database here; every filter
// control (the chips, a row's kind icon and author, the author chip) is a
// `Link` to one of these searches. Unit-tested in web:unit.
//
// - Unknown values are ignored: they read as "no filter".
// - The filters are independent: changing one keeps the others.
// - Setting a filter that's already on returns the search unchanged.
// - Parameters this module doesn't own are kept.

export type TimelineFilters = {
  /** One kind of entry, or null for every kind. */
  kind: TimelineEntryKind | null;
  /** The user id of one author (`created_by`), or null for everyone. */
  author: string | null;
  /** The search text, trimmed and capped (`SEARCH_MAX_LENGTH`), or "" for none. */
  q: string;
  /** The Upcoming block above Today is on (`?upcoming=1`). Not a filter: `clearFilters` keeps it. */
  upcoming: boolean;
  /**
   * One care period's id: the search's matches within its dates. Only with a
   * search (`q`): without one it reads as null, and clearing the search clears it.
   */
  period: string | null;
};

export const KIND_PARAM = "kind";
export const AUTHOR_PARAM = "author";
export const QUERY_PARAM = "q";
export const UPCOMING_PARAM = "upcoming";
export const PERIOD_PARAM = "period";

/**
 * The kinds the timeline lists and filters by. A kind left out of here is
 * stored and synced but skipped by the timeline (`SHOWN_KINDS_SQL`), until it
 * can render it. New kinds are appended.
 */
export const TIMELINE_KINDS = [
  "note",
  "symptom",
  "event",
  "vital",
  "dose",
  "medicationChange",
] as const satisfies readonly TimelineEntryKind[];

export const isTimelineKind = (value: string | null): value is (typeof TIMELINE_KINDS)[number] =>
  (TIMELINE_KINDS as readonly string[]).includes(value ?? "");

const isKind = isTimelineKind;

// User ids are UUIDs. Whether it's a current member isn't checked here: a
// former member's entries can still be filtered.
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isAuthor = (value: string | null): value is string => !!value && USER_ID.test(value);

/** A row id in a URL (a UUID, any case): an author or a care period. Whether it exists isn't checked here. */
export const isRowId = (value: string | null | undefined): value is string => !!value && USER_ID.test(value);

/** Search text as the URL keeps it: trimmed, capped, with runs of spaces as one. */
export const normalizeQuery = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH).trim();

/** The filters in a search string (`location.search`, with or without the `?`). */
export const parseFilters = (search: string): TimelineFilters => {
  const params = new URLSearchParams(search);
  const kind = params.get(KIND_PARAM);
  const author = params.get(AUTHOR_PARAM);
  const period = params.get(PERIOD_PARAM);
  const q = normalizeQuery(params.get(QUERY_PARAM));
  return {
    kind: isKind(kind) ? kind : null,
    author: isAuthor(author) ? author.toLowerCase() : null,
    q,
    upcoming: params.get(UPCOMING_PARAM) === "1",
    period: q && isRowId(period) ? period.toLowerCase() : null,
  };
};

/** True when any filter (kind, author or search) is on. */
export const hasFilters = (filters: TimelineFilters) => !!filters.kind || !!filters.author || !!filters.q;

/** `search` with the filters replaced: kind first, then author, then q, then period, then upcoming, then whatever else was there. */
const withFilters = (search: string, next: TimelineFilters) => {
  const params = new URLSearchParams(search);
  params.delete(KIND_PARAM);
  params.delete(AUTHOR_PARAM);
  params.delete(QUERY_PARAM);
  params.delete(UPCOMING_PARAM);
  params.delete(PERIOD_PARAM);
  const out = new URLSearchParams();
  if (next.kind) out.set(KIND_PARAM, next.kind);
  if (next.author) out.set(AUTHOR_PARAM, next.author);
  if (next.q) out.set(QUERY_PARAM, next.q);
  if (next.q && next.period) out.set(PERIOD_PARAM, next.period);
  if (next.upcoming) out.set(UPCOMING_PARAM, "1");
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

/** Apply a change, or return `search` as it is when the change changes nothing. */
const change = (search: string, patch: Partial<TimelineFilters>) => {
  const current = parseFilters(search);
  const next = { ...current, ...patch };
  // The period narrows a search: without one it goes too.
  if (!next.q) next.period = null;
  if (
    next.kind === current.kind &&
    next.author === current.author &&
    next.q === current.q &&
    next.upcoming === current.upcoming &&
    next.period === current.period
  )
    return search;
  return withFilters(search, next);
};

/** Show one kind. An unknown kind changes nothing. */
export const setKind = (search: string, kind: TimelineEntryKind) =>
  isKind(kind) ? change(search, { kind }) : search;

/** Show one author's entries. An id that isn't a user id changes nothing. */
export const setAuthor = (search: string, author: string) =>
  isAuthor(author) ? change(search, { author: author.toLowerCase() }) : search;

/** Every kind again; the author filter stays. */
export const clearKind = (search: string) => change(search, { kind: null });

/** Everyone's entries again; the kind filter stays. */
export const clearAuthor = (search: string) => change(search, { author: null });

/** No filters and no search or period (the Upcoming block stays as it is). */
export const clearFilters = (search: string) => change(search, { kind: null, author: null, q: "" });

/** Search for `q` (trimmed and capped); blank text clears the search. The other filters stay. */
export const setQuery = (search: string, q: string) => change(search, { q: normalizeQuery(q) });

/** No search (and so no period); the kind and author filters stay. */
export const clearQuery = (search: string) => change(search, { q: "" });

/** Show the Upcoming block above Today; the filters stay. */
export const setUpcoming = (search: string) => change(search, { upcoming: true });

/** Hide the Upcoming block; the filters stay. */
export const clearUpcoming = (search: string) => change(search, { upcoming: false });

/**
 * Narrow the search to one care period's dates. Only while searching: with
 * no search, or an id that isn't a row id, it changes nothing.
 */
export const setPeriod = (search: string, period: string) =>
  isRowId(period) && parseFilters(search).q ? change(search, { period: period.toLowerCase() }) : search;

/** The search over every date again; the search and the other filters stay. */
export const clearPeriod = (search: string) => change(search, { period: null });

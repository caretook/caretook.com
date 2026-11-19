import type { TimelineEntryKind } from "@caretook/data/schema";

// The timeline's filters live in the URL: `?kind=<kind>&author=<userId>`,
// plus the Upcoming block's switch (`?upcoming=1`), kept with them.
// This module owns that state: reading it from a search string, and the
// search string for each change. No React or database here; every filter
// control (the chips, a row's kind icon and author, the author chip) is a
// `Link` to one of these searches. Unit-tested in web:unit.
//
// - Unknown values are ignored: they read as "no filter".
// - The two filters are independent: changing one keeps the other.
// - Setting a filter that's already on returns the search unchanged.
// - Parameters this module doesn't own are kept.

export type TimelineFilters = {
  /** One kind of entry, or null for every kind. */
  kind: TimelineEntryKind | null;
  /** The user id of one author (`created_by`), or null for everyone. */
  author: string | null;
  /** The Upcoming block above Today is on (`?upcoming=1`). Not a filter: `clearFilters` keeps it. */
  upcoming: boolean;
};

export const KIND_PARAM = "kind";
export const AUTHOR_PARAM = "author";
export const UPCOMING_PARAM = "upcoming";

/**
 * The kinds the timeline lists and filters by. Doses and medication changes
 * are stored and synced already, but the timeline skips them until it can
 * render them: `medications` slice 4 appends them here.
 */
export const TIMELINE_KINDS = [
  "note",
  "symptom",
  "event",
  "vital",
] as const satisfies readonly TimelineEntryKind[];

export const isTimelineKind = (value: string | null): value is (typeof TIMELINE_KINDS)[number] =>
  (TIMELINE_KINDS as readonly string[]).includes(value ?? "");

const isKind = isTimelineKind;

// User ids are UUIDs. Whether it's a current member isn't checked here: a
// former member's entries can still be filtered.
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isAuthor = (value: string | null): value is string => !!value && USER_ID.test(value);

/** The filters in a search string (`location.search`, with or without the `?`). */
export const parseFilters = (search: string): TimelineFilters => {
  const params = new URLSearchParams(search);
  const kind = params.get(KIND_PARAM);
  const author = params.get(AUTHOR_PARAM);
  return {
    kind: isKind(kind) ? kind : null,
    author: isAuthor(author) ? author.toLowerCase() : null,
    upcoming: params.get(UPCOMING_PARAM) === "1",
  };
};

/** True when either filter is on. */
export const hasFilters = (filters: TimelineFilters) => !!filters.kind || !!filters.author;

/** `search` with the filters replaced: kind first, then author, then upcoming, then whatever else was there. */
const withFilters = (search: string, next: TimelineFilters) => {
  const params = new URLSearchParams(search);
  params.delete(KIND_PARAM);
  params.delete(AUTHOR_PARAM);
  params.delete(UPCOMING_PARAM);
  const out = new URLSearchParams();
  if (next.kind) out.set(KIND_PARAM, next.kind);
  if (next.author) out.set(AUTHOR_PARAM, next.author);
  if (next.upcoming) out.set(UPCOMING_PARAM, "1");
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

/** Apply a change, or return `search` as it is when the change changes nothing. */
const change = (search: string, patch: Partial<TimelineFilters>) => {
  const current = parseFilters(search);
  const next = { ...current, ...patch };
  if (next.kind === current.kind && next.author === current.author && next.upcoming === current.upcoming)
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

/** No filters (the Upcoming block stays as it is). */
export const clearFilters = (search: string) => change(search, { kind: null, author: null });

/** Show the Upcoming block above Today; the filters stay. */
export const setUpcoming = (search: string) => change(search, { upcoming: true });

/** Hide the Upcoming block; the filters stay. */
export const clearUpcoming = (search: string) => change(search, { upcoming: false });

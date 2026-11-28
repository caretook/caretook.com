import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";

import { TAG_PARAM, tagFromParams, VITAL_TYPES } from "@caretook/data/schema";
import { SEARCH_MAX_LENGTH } from "@caretook/data/domain";

// The timeline's filters live in the URL: `?kind=<kind>&author=<userId>`
// and the search `?q=<text>` (narrowed to one care period by `?period=<id>`
// while it's on), with `?vital=<type>` under `kind=vital` and the repeated
// `?symptom=<id>` (catalog rows, any of them) under `kind=symptom`, and
// `?tag=<id>` (one tag; the param is tagRules' `TAG_PARAM`, and whether it's
// one of the group's tags is the screen's to check).
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
  /** One vital type (`?vital=`), only while the kind is `vital`; null for every type. */
  vital: VitalType | null;
  /**
   * Catalog rows (`symptom_type` ids, `?symptom=` repeated): entries of any
   * of them, only while the kind is `symptom`; empty for every symptom.
   * Lower-case, each once, in the URL's order.
   */
  symptoms: readonly string[];
  /**
   * One care period's id: the search's matches within its dates. Only with a
   * search (`q`): without one it reads as null, and clearing the search clears it.
   */
  period: string | null;
  /** One tag's id (`?tag=`, lower-case), or null for every entry. Whether the group has it isn't checked here. */
  tag: string | null;
};

export const KIND_PARAM = "kind";
export const AUTHOR_PARAM = "author";
export const QUERY_PARAM = "q";
export const VITAL_PARAM = "vital";
export const SYMPTOM_PARAM = "symptom";
export const PERIOD_PARAM = "period";
/** A jump to one day (`?day=YYYY-MM-DD`, the viewer's): read by `readDay`, not a filter. */
export const DAY_PARAM = "day";

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
  "conditionChange",
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
    vital: kind === "vital" ? vitalType(params.get(VITAL_PARAM)) : null,
    symptoms: kind === "symptom" ? symptomIds(params.getAll(SYMPTOM_PARAM)) : [],
    period: q && isRowId(period) ? period.toLowerCase() : null,
    tag: tagFromParams(params),
  };
};

/** True when any filter (kind, author, tag or search) is on. */
export const hasFilters = (filters: TimelineFilters) =>
  !!filters.kind || !!filters.author || !!filters.tag || !!filters.q;

/** `search` with the filters replaced: kind first, then author, then q, then period, then vital or the symptoms, then the tag, then whatever else was there. */
const withFilters = (search: string, next: TimelineFilters) => {
  const params = new URLSearchParams(search);
  params.delete(KIND_PARAM);
  params.delete(AUTHOR_PARAM);
  params.delete(QUERY_PARAM);
  params.delete(VITAL_PARAM);
  params.delete(SYMPTOM_PARAM);
  params.delete(PERIOD_PARAM);
  params.delete(TAG_PARAM);
  // Any filter change starts again from the newest entry.
  params.delete(DAY_PARAM);
  const out = new URLSearchParams();
  if (next.kind) out.set(KIND_PARAM, next.kind);
  if (next.author) out.set(AUTHOR_PARAM, next.author);
  if (next.q) out.set(QUERY_PARAM, next.q);
  if (next.q && next.period) out.set(PERIOD_PARAM, next.period);
  if (next.vital && next.kind === "vital") out.set(VITAL_PARAM, next.vital);
  if (next.kind === "symptom") for (const id of next.symptoms) out.append(SYMPTOM_PARAM, id);
  if (next.tag) out.set(TAG_PARAM, next.tag);
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
    next.period === current.period &&
    next.tag === current.tag &&
    (next.kind === "vital" ? next.vital : null) === current.vital &&
    sameIds(next.kind === "symptom" ? next.symptoms : [], current.symptoms)
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

/** Show only the entries carrying one tag; the other filters stay. An id that isn't a row id changes nothing. */
export const setTag = (search: string, tag: string) =>
  isRowId(tag) ? change(search, { tag: tag.toLowerCase() }) : search;

/** Every entry again, tagged or not; the other filters stay. */
export const clearTag = (search: string) => change(search, { tag: null });

/** No filters (the tag too) and no search or period. */
export const clearFilters = (search: string) =>
  change(search, { kind: null, author: null, q: "", tag: null });

/** Search for `q` (trimmed and capped); blank text clears the search. The other filters stay. */
export const setQuery = (search: string, q: string) => change(search, { q: normalizeQuery(q) });

/** No search (and so no period); the kind and author filters stay. */
export const clearQuery = (search: string) => change(search, { q: "" });

const vitalType = (value: string | null): VitalType | null =>
  (VITAL_TYPES as readonly string[]).includes(value ?? "") ? (value as VitalType) : null;

/** Show one vital type (and so only vitals); the author filter and the search stay. An unknown type changes nothing. */
export const setVital = (search: string, vital: VitalType) =>
  vitalType(vital) ? change(search, { kind: "vital", vital }) : search;

/** Every vital type again; the kind (vitals) stays. */
export const clearVital = (search: string) => change(search, { vital: null });

/** Valid catalog ids, lower-case, each once, in order; anything else is dropped. */
const symptomIds = (values: readonly string[]) => [
  ...new Set(values.filter((v) => isRowId(v)).map((v) => v.toLowerCase())),
];

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Add one symptom type to the filter (and so show only symptoms), after the
 * ones already on; the author filter and the search stay. An id that isn't a
 * row id, or one already on, changes nothing.
 */
export const addSymptom = (search: string, id: string) => {
  if (!isRowId(id)) return search;
  const { kind, symptoms } = parseFilters(search);
  const current = kind === "symptom" ? symptoms : [];
  return change(search, { kind: "symptom", symptoms: symptomIds([...current, id]) });
};

/** Take one symptom type off the filter; the kind (symptoms) and the others stay. */
export const removeSymptom = (search: string, id: string) => {
  const { symptoms } = parseFilters(search);
  return change(search, { symptoms: symptoms.filter((s) => s !== id.toLowerCase()) });
};

/** Every symptom type again; the kind (symptoms) stays. */
export const clearSymptoms = (search: string) => change(search, { symptoms: [] });
/**
 * Narrow the search to one care period's dates. Only while searching: with
 * no search, or an id that isn't a row id, it changes nothing.
 */
export const setPeriod = (search: string, period: string) =>
  isRowId(period) && parseFilters(search).q ? change(search, { period: period.toLowerCase() }) : search;

/** The search over every date again; the search and the other filters stay. */
export const clearPeriod = (search: string) => change(search, { period: null });

/** A real calendar day written `YYYY-MM-DD` ("2026-02-30" isn't). */
const isCalendarDay = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/**
 * The day the timeline is jumped to, or null. A malformed or impossible date
 * reads as no jump, as does a day after `today` (the viewer's) or a `?day=`
 * beside a search, since a jump ends a search.
 */
export const readDay = (search: string, today: string) => {
  const params = new URLSearchParams(search);
  const day = params.get(DAY_PARAM);
  return isCalendarDay(day) && day <= today && !normalizeQuery(params.get(QUERY_PARAM)) ? day : null;
};

/** Jump to `day`: the kind, author, vital, symptom and tag filters stay, the search and its period end. An invalid day changes nothing. */
export const setDay = (search: string, day: string) => {
  if (!isCalendarDay(day)) return search;
  const params = new URLSearchParams(withFilters(search, { ...parseFilters(search), q: "", period: null }));
  params.set(DAY_PARAM, day);
  return `?${params.toString()}`;
};

/** Back to the newest entries; the filters stay. */
export const clearDay = (search: string) => {
  const params = new URLSearchParams(search);
  if (!params.has(DAY_PARAM)) return search;
  params.delete(DAY_PARAM);
  const text = params.toString();
  return text ? `?${text}` : "";
};

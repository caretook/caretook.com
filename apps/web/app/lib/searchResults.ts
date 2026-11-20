import type { SearchItemType } from "@caretook/data/schema";

import { SEARCH_MAX_LENGTH } from "@caretook/data/schema";
import { isSearchItemType, SEARCH_ALL_PARAM, SEARCH_PERIOD_PARAM, SEARCH_QUERY_PARAM } from "./appUrls";
import { isRowId } from "./timelineFilters";

// The search page's results: what its URL asks for, which sections it shows
// in what order, the order of results inside each, how many each shows, and
// the polite count. The matching itself is the device index's
// (`lib/sync/search.ts`); this module only arranges its hits. No React or
// database here; unit-tested in web:unit.

/** A match as the device index returns it (`SearchHit` in `lib/sync/search.ts`). */
export type RankedHit = {
  id: string;
  type: SearchItemType;
  /** bm25: lower is better. */
  rank: number;
  /** Every searched word matched in a title-like field (title, name, symptom, medication, provider). */
  titleMatch: boolean;
  /** An entry's time (ISO 8601 or the local timestamp form); null for providers, medications and tasks. */
  occurredAt: string | null;
};

/** One type's matches: the first few, and how many there are in all. */
export type HitSection = { hits: readonly RankedHit[]; total: number };

/** What the page's URL asks for: the text (as typed), the section shown in full, and the care period it's narrowed to. */
export type SearchPageQuery = { q: string; all: SearchItemType | null; period: string | null };

/** Sections in page order: the things you'd look up by name first, then tasks, then the timeline's entries. */
export const SECTION_ORDER: readonly SearchItemType[] = ["provider", "medication", "task", "entry"];

/** How many results a section shows before "Show all N". */
export const SECTION_SIZE = 5;

/** How many a section shows in full (`?all=`); the timeline has the rest of the entries. */
export const FULL_SECTION_SIZE = 100;

export const SECTION_LABELS: Record<SearchItemType, string> = {
  provider: "Providers",
  medication: "Medications",
  task: "Tasks",
  entry: "Timeline entries",
};

const NOUNS: Record<SearchItemType, [one: string, many: string]> = {
  provider: ["provider", "providers"],
  medication: ["medication", "medications"],
  task: ["task", "tasks"],
  entry: ["entry", "entries"],
};

/**
 * `?q=` (capped at the parser's length), `?all=` (only a known type) and
 * `?period=` (a row id; whether it's a period of the group is the page's
 * to check), the last two only with a search.
 */
export const parseSearchPage = (search: string): SearchPageQuery => {
  const params = new URLSearchParams(search);
  const q = (params.get(SEARCH_QUERY_PARAM) ?? "").slice(0, SEARCH_MAX_LENGTH);
  const all = params.get(SEARCH_ALL_PARAM);
  const period = params.get(SEARCH_PERIOD_PARAM);
  const searching = !!q.trim();
  return {
    q,
    all: searching && isSearchItemType(all) ? all : null,
    period: searching && isRowId(period) ? period.toLowerCase() : null,
  };
};

/** How many of each type to ask the index for: a few, or (for the section shown in full) many. */
export const sectionLimits = (all: SearchItemType | null): Record<SearchItemType, number> => ({
  provider: all === "provider" ? FULL_SECTION_SIZE : SECTION_SIZE,
  medication: all === "medication" ? FULL_SECTION_SIZE : SECTION_SIZE,
  task: all === "task" ? FULL_SECTION_SIZE : SECTION_SIZE,
  entry: all === "entry" ? FULL_SECTION_SIZE : SECTION_SIZE,
});

/** Milliseconds since the epoch, from ISO 8601, the device's form or Postgres's ("… 10:00:00+00"). */
const time = (value: string | null) =>
  value ? Date.parse(value.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")) || 0 : 0;

/**
 * Best match first: every word in a title-like field above a match only in
 * the text, then the index's rank, then (entries) the newest; the id last,
 * so the order never changes between two identical searches.
 */
export const compareHits = (a: RankedHit, b: RankedHit) =>
  Number(b.titleMatch) - Number(a.titleMatch) ||
  a.rank - b.rank ||
  time(b.occurredAt) - time(a.occurredAt) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export type ResultSection = {
  type: SearchItemType;
  label: string;
  /** The results shown, best first. */
  hits: RankedHit[];
  /** How many match in all. */
  total: number;
  /** How many match but aren't shown ("Show all N"). */
  hidden: number;
  /** Shown in full (`?all=`): it offers "Show fewer". */
  full: boolean;
};

/**
 * The page's sections in `SECTION_ORDER`, leaving out types with no
 * matches: each sorted by `compareHits`, cut to `SECTION_SIZE` (or
 * `FULL_SECTION_SIZE` for `all`).
 */
export const searchSections = (
  results: Partial<Record<SearchItemType, HitSection>>,
  { all = null }: { all?: SearchItemType | null } = {},
): ResultSection[] =>
  SECTION_ORDER.flatMap((type) => {
    const section = results[type];
    if (!section || section.total <= 0) return [];
    const full = all === type;
    const hits = [...section.hits].sort(compareHits).slice(0, full ? FULL_SECTION_SIZE : SECTION_SIZE);
    return [
      {
        type,
        label: SECTION_LABELS[type],
        hits,
        total: section.total,
        hidden: section.total - hits.length,
        full,
      },
    ];
  });

/** "3 providers", "1 entry". */
export const countText = (type: SearchItemType, n: number) => `${n} ${NOUNS[type][n === 1 ? 0 : 1]}`;

/**
 * The polite announcement of a search's results: "2 medications and 14
 * entries", or "No matches for "knee"".
 */
export const resultCountText = (sections: readonly ResultSection[], q: string) => {
  const parts = sections.map((s) => countText(s.type, s.total));
  if (!parts.length) return `No matches for “${q.trim()}”`;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
};

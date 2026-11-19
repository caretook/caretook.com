import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { PROVIDER_TYPES } from "@caretook/data/schema";

// The provider directory's list: its filters in the URL (`?q=`, `?type=`,
// `?past=1`), the display order, and search matching. Pure: no React or
// database here; the list, and later the With picker, use it, and web:unit
// tests it.
//
// Like `timelineFilters`: unknown values read as "no filter", a change that
// changes nothing returns the search as it was, and parameters this module
// doesn't own are kept.

export type DirectoryFilters = {
  /** What's typed in the search box (trimmed), or "". */
  q: string;
  /** One type of provider, or null for every type. */
  type: ProviderType | null;
  /** Whether past providers are listed (at the bottom). */
  past: boolean;
};

export const QUERY_PARAM = "q";
export const TYPE_PARAM = "type";
export const PAST_PARAM = "past";

/** How each type is named on screen. */
export const PROVIDER_TYPE_META: Record<ProviderType, { label: string; plural: string }> = {
  clinician: { label: "Clinician", plural: "Clinicians" },
  practice: { label: "Practice", plural: "Practices" },
  pharmacy: { label: "Pharmacy", plural: "Pharmacies" },
  other: { label: "Other contact", plural: "Other" },
};

export const isProviderType = (value: string | null): value is ProviderType =>
  (PROVIDER_TYPES as readonly string[]).includes(value ?? "");

/** The filters in a search string (`location.search`, with or without the `?`). */
export const parseDirectoryFilters = (search: string): DirectoryFilters => {
  const params = new URLSearchParams(search);
  const type = params.get(TYPE_PARAM);
  return {
    q: (params.get(QUERY_PARAM) ?? "").trim(),
    type: isProviderType(type) ? type : null,
    past: params.get(PAST_PARAM) === "1",
  };
};

/** `search` with the filters replaced: q, type, past, then whatever else was there. */
const withFilters = (search: string, next: DirectoryFilters) => {
  const params = new URLSearchParams(search);
  for (const key of [QUERY_PARAM, TYPE_PARAM, PAST_PARAM]) params.delete(key);
  const out = new URLSearchParams();
  if (next.q) out.set(QUERY_PARAM, next.q);
  if (next.type) out.set(TYPE_PARAM, next.type);
  if (next.past) out.set(PAST_PARAM, "1");
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

const change = (search: string, patch: Partial<DirectoryFilters>) => {
  const current = parseDirectoryFilters(search);
  const next = { ...current, ...patch };
  if (next.q === current.q && next.type === current.type && next.past === current.past) return search;
  return withFilters(search, next);
};

/** Search for `q` (trimmed; empty clears the search). */
export const setQuery = (search: string, q: string) => change(search, { q: q.trim() });

/** Show one type. An unknown type changes nothing. */
export const setType = (search: string, type: ProviderType) =>
  isProviderType(type) ? change(search, { type }) : search;

/** Every type again. */
export const clearType = (search: string) => change(search, { type: null });

/** List past providers too, or not. */
export const setPast = (search: string, past: boolean) => change(search, { past });

// ---------------------------------------------------------------------------
// Order and matching
// ---------------------------------------------------------------------------

export type ListedProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** 0 primary (and current), 1 current, 2 past. */
const rank = (p: ListedProvider) => (p.status === "past" ? 2 : p.isPrimary ? 0 : 1);

/** The display order: primary first, then current, then past, each by name (then id, so it's stable). */
export const compareProviders = (a: ListedProvider, b: ListedProvider) =>
  rank(a) - rank(b) || collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Lowercased, without accents, so "jose" finds "José". */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** The words of a search, folded. */
export const queryTokens = (q: string) => fold(q).split(/\s+/).filter(Boolean);

/**
 * Whether a provider matches every word of the search, each somewhere in its
 * name, specialty (or role) or its practice's name: "cardio" finds the
 * cardiologist, and a clinic's name finds its clinicians. No words match all.
 */
export const matchesQuery = (provider: ListedProvider, tokens: string[], practiceName?: string | null) => {
  if (tokens.length === 0) return true;
  const haystack = fold([provider.name, provider.specialty ?? "", practiceName ?? ""].join(" "));
  return tokens.every((token) => haystack.includes(token));
};

export type DirectoryList<P extends ListedProvider> = {
  /** Current providers that match, primary first. */
  current: P[];
  /** Past providers that match: listed only with `?past=1`. */
  past: P[];
};

/**
 * The list for these filters: the providers that match the type and search,
 * in display order, split into current and past. Past ones are counted even
 * when hidden, so "Show past" can say how many match.
 */
export const directoryList = <P extends ListedProvider>(
  providers: readonly P[],
  filters: Pick<DirectoryFilters, "q" | "type">,
): DirectoryList<P> => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(filters.q);
  const matching = providers
    .filter((p) => !filters.type || p.type === filters.type)
    .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
    .sort(compareProviders);
  return {
    current: matching.filter((p) => p.status !== "past"),
    past: matching.filter((p) => p.status === "past"),
  };
};

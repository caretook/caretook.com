import type { MedicationStatus, MedicationType } from "@caretook/data/schema";

import type { TagsByRecord } from "../providers/providerDirectory";

import {
  MEDICATION_STATUSES,
  MEDICATION_TYPES,
  TAG_PARAM,
  tagFromParams,
  withTagParam,
} from "@caretook/data/schema";
import { fold, hasTag, queryTokens } from "../providers/providerDirectory";

// The medication list: its filters in the URL (`?q=`, `?status=`, `?type=`, `?tag=`), the
// display order, and search matching. Pure: no React or database here; the
// list uses it, and web:unit tests it.
//
// Like `providerDirectory`: unknown values read as "no filter", a change that
// changes nothing returns the search as it was, and parameters this module
// doesn't own are kept.

export type MedicationFilters = {
  /** What's typed in the search box (trimmed), or "". */
  q: string;
  /** One status, or null for all of them (current first, the rest below). */
  status: MedicationStatus | null;
  /** One type, or null for all of them. */
  type: MedicationType | null;
  /** One tag's id (tags PRD), or null. Whether the group has it is the screen's to check (`activeTag`). */
  tag?: string | null;
};

export const QUERY_PARAM = "q";
export const STATUS_PARAM = "status";
export const TYPE_PARAM = "type";

export const isMedicationStatus = (value: string | null): value is MedicationStatus =>
  (MEDICATION_STATUSES as readonly string[]).includes(value ?? "");

export const isMedicationType = (value: string | null): value is MedicationType =>
  (MEDICATION_TYPES as readonly string[]).includes(value ?? "");

/** The filters in a search string (`location.search`, with or without the `?`). `status=all` is no filter. */
export const parseMedicationFilters = (search: string): MedicationFilters => {
  const params = new URLSearchParams(search);
  const status = params.get(STATUS_PARAM);
  const type = params.get(TYPE_PARAM);
  return {
    q: (params.get(QUERY_PARAM) ?? "").trim(),
    status: isMedicationStatus(status) ? status : null,
    type: isMedicationType(type) ? type : null,
    tag: tagFromParams(params),
  };
};

/** `search` with the filters replaced: q, status, type, tag, then whatever else was there. */
const withFilters = (search: string, next: MedicationFilters) => {
  const params = new URLSearchParams(search);
  for (const key of [QUERY_PARAM, STATUS_PARAM, TYPE_PARAM, TAG_PARAM]) params.delete(key);
  let out = new URLSearchParams();
  if (next.q) out.set(QUERY_PARAM, next.q);
  if (next.status) out.set(STATUS_PARAM, next.status);
  if (next.type) out.set(TYPE_PARAM, next.type);
  out = withTagParam(out, next.tag ?? null);
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

const change = (search: string, patch: Partial<MedicationFilters>) => {
  const current = parseMedicationFilters(search);
  const next = { ...current, ...patch };
  const raw = new URLSearchParams(search);
  const rawStatus = raw.get(STATUS_PARAM);
  const rawType = raw.get(TYPE_PARAM);
  // A status or type the module doesn't know ("all", a typo) is dropped on the next change.
  const tidy =
    (rawStatus === null || isMedicationStatus(rawStatus)) && (rawType === null || isMedicationType(rawType));
  const same =
    next.q === current.q &&
    next.status === current.status &&
    next.type === current.type &&
    next.tag === current.tag;
  if (same && tidy) return search;
  return withFilters(search, next);
};

/** Search for `q` (trimmed; empty clears the search). */
export const setQuery = (search: string, q: string) => change(search, { q: q.trim() });

/** Show one status. An unknown status changes nothing. */
export const setStatus = (search: string, status: MedicationStatus) =>
  isMedicationStatus(status) ? change(search, { status }) : search;

/** Every status again. */
export const clearStatus = (search: string) => change(search, { status: null });

/** Show one type. An unknown type changes nothing. */
export const setType = (search: string, type: MedicationType) =>
  isMedicationType(type) ? change(search, { type }) : search;

/** Every type again. */
export const clearType = (search: string) => change(search, { type: null });

/** Show the medications with one tag (an id). Not an id changes nothing. */
export const setTag = (search: string, tagId: string) => {
  const tag = tagFromParams(withTagParam(new URLSearchParams(), tagId));
  return tag ? change(search, { tag }) : search;
};

/** Every tag again. */
export const clearTag = (search: string) => change(search, { tag: null });

/** Clear filters: the status, type and tag, keeping the search. */
export const clearFilters = (search: string) => change(search, { status: null, type: null, tag: null });

// ---------------------------------------------------------------------------
// Order and matching
// ---------------------------------------------------------------------------

export type ListedMedication = {
  id: string;
  name: string;
  reason: string | null;
  status: MedicationStatus;
  /** Null for a medication added before types existed. */
  type: MedicationType | null;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** The display order: current first, then the rest, each by name (then id, so it's stable). */
export const compareMedications = (a: ListedMedication, b: ListedMedication) =>
  Number(a.status !== "current") - Number(b.status !== "current") ||
  collator.compare(a.name, b.name) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Whether a medication matches every word of the search, each somewhere in
 * its name or the reason it's taken: "blood" finds the blood pressure
 * tablet. Case and accents are ignored; no words match all.
 */
export const matchesMedication = (medication: ListedMedication, tokens: string[]) => {
  if (tokens.length === 0) return true;
  const haystack = fold(`${medication.name} ${medication.reason ?? ""}`);
  return tokens.every((token) => haystack.includes(token));
};

export type MedicationList<M extends ListedMedication> = {
  /** Current medications that match, by name. */
  current: M[];
  /** Completed and discontinued ones that match, by name: listed below the current ones. */
  stopped: M[];
};

/**
 * The list for these filters: the medications that match the type, status,
 * tag (by `tags`; pass the tag only once `activeTag` knows it) and search,
 * in display order.
 */
export const medicationList = <M extends ListedMedication>(
  medications: readonly M[],
  filters: MedicationFilters,
  tags?: TagsByRecord,
): MedicationList<M> => {
  const tokens = queryTokens(filters.q);
  const matching = medications
    .filter((m) => !filters.type || m.type === filters.type)
    .filter((m) => hasTag(tags, m.id, filters.tag ?? null))
    .filter((m) => !filters.status || m.status === filters.status)
    .filter((m) => matchesMedication(m, tokens))
    .sort(compareMedications);
  return {
    current: matching.filter((m) => m.status === "current"),
    stopped: matching.filter((m) => m.status !== "current"),
  };
};

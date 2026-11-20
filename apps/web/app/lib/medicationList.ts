import type { MedicationStatus } from "@caretook/data/schema";

import { MEDICATION_STATUSES } from "@caretook/data/schema";
import { fold, queryTokens } from "./providerDirectory";

// The medication list: its filters in the URL (`?q=`, `?status=`), the
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
};

export const QUERY_PARAM = "q";
export const STATUS_PARAM = "status";

export const isMedicationStatus = (value: string | null): value is MedicationStatus =>
  (MEDICATION_STATUSES as readonly string[]).includes(value ?? "");

/** The filters in a search string (`location.search`, with or without the `?`). `status=all` is no filter. */
export const parseMedicationFilters = (search: string): MedicationFilters => {
  const params = new URLSearchParams(search);
  const status = params.get(STATUS_PARAM);
  return {
    q: (params.get(QUERY_PARAM) ?? "").trim(),
    status: isMedicationStatus(status) ? status : null,
  };
};

/** `search` with the filters replaced: q, status, then whatever else was there. */
const withFilters = (search: string, next: MedicationFilters) => {
  const params = new URLSearchParams(search);
  for (const key of [QUERY_PARAM, STATUS_PARAM]) params.delete(key);
  const out = new URLSearchParams();
  if (next.q) out.set(QUERY_PARAM, next.q);
  if (next.status) out.set(STATUS_PARAM, next.status);
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

const change = (search: string, patch: Partial<MedicationFilters>) => {
  const current = parseMedicationFilters(search);
  const next = { ...current, ...patch };
  const raw = new URLSearchParams(search).get(STATUS_PARAM);
  // A status the module doesn't know ("all", a typo) is dropped on the next change.
  const tidy = raw === null || isMedicationStatus(raw);
  if (next.q === current.q && next.status === current.status && tidy) return search;
  return withFilters(search, next);
};

/** Search for `q` (trimmed; empty clears the search). */
export const setQuery = (search: string, q: string) => change(search, { q: q.trim() });

/** Show one status. An unknown status changes nothing. */
export const setStatus = (search: string, status: MedicationStatus) =>
  isMedicationStatus(status) ? change(search, { status }) : search;

/** Every status again. */
export const clearStatus = (search: string) => change(search, { status: null });

// ---------------------------------------------------------------------------
// Order and matching
// ---------------------------------------------------------------------------

export type ListedMedication = {
  id: string;
  name: string;
  reason: string | null;
  status: MedicationStatus;
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

/** The list for these filters: the medications that match the status and search, in display order. */
export const medicationList = <M extends ListedMedication>(
  medications: readonly M[],
  filters: MedicationFilters,
): MedicationList<M> => {
  const tokens = queryTokens(filters.q);
  const matching = medications
    .filter((m) => !filters.status || m.status === filters.status)
    .filter((m) => matchesMedication(m, tokens))
    .sort(compareMedications);
  return {
    current: matching.filter((m) => m.status === "current"),
    stopped: matching.filter((m) => m.status !== "current"),
  };
};

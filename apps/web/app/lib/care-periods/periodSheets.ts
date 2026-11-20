import type { CarePeriodType } from "@caretook/data/schema";

import { isCarePeriodType } from "@caretook/data/schema";
import { appUrls, PERIOD_PREFILL_PARAMS } from "../app-shell/appUrls";

// The care periods page's sheet routes (`periods/new`, later
// `periods/:periodId/edit`): which sheet a URL opens, or where it goes
// instead, what the add sheet starts with, and the history state that lets
// a sheet go back to where it was opened from (the periods page, the
// timeline's line, an entry's suggestion). Pure, so web:unit tests it; the
// routes apply it. It lives in lib/ because other screens open the sheet.

/** History state on a link that opens a period sheet, so closing it goes back. */
export const PERIOD_SHEET_STATE = { periodSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "periodSheet" in state;

/** What a sheet URL shows: its sheet, or a redirect (the periods page). */
export type PeriodSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** `periods/new`: the add sheet, for writers; a viewer gets the periods page. */
export const newPeriodGuard = ({
  groupId,
  canWrite,
}: {
  groupId: string;
  canWrite: boolean;
}): PeriodSheetDecision<true> => (canWrite ? { sheet: true } : { redirect: appUrls.periods(groupId) });

/**
 * `periods/:periodId/edit`: a live period in this group, for a writer. A
 * viewer, and a period that's missing, deleted or in another group, get the
 * periods page (with no names: they all look the same).
 */
export const editPeriodGuard = <P extends { groupId: string; deletedAt: string | null }>({
  groupId,
  canWrite,
  period,
}: {
  groupId: string;
  canWrite: boolean;
  period: P | null;
}): PeriodSheetDecision<P> =>
  canWrite && period && period.groupId === groupId && !period.deletedAt
    ? { sheet: period }
    : { redirect: appUrls.periods(groupId) };

/** What the add sheet starts with. Anything missing or malformed is left to the defaults (now, no place). */
export type PeriodPrefillValues = {
  type: CarePeriodType | null;
  /** ISO 8601, or null for now. */
  startedAt: string | null;
  dateOnly: boolean;
  placeProviderId: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The add sheet's prefills from its URL (`?type=`, `?startedAt=`,
 * `?dateOnly=1`, `?place=`). An unknown type, a start that isn't a time and
 * a place that isn't an id are dropped; the form checks the rest (the place
 * must be in the group, the start not in the future) when it saves.
 */
export const parsePeriodPrefill = (search: string): PeriodPrefillValues => {
  const params = new URLSearchParams(search);
  const type = params.get(PERIOD_PREFILL_PARAMS.type);
  const startedAt = params.get(PERIOD_PREFILL_PARAMS.startedAt);
  const at = startedAt ? new Date(startedAt) : null;
  const place = params.get(PERIOD_PREFILL_PARAMS.place);
  return {
    type: isCarePeriodType(type) ? type : null,
    startedAt: at && Number.isFinite(at.getTime()) ? at.toISOString() : null,
    dateOnly: params.get(PERIOD_PREFILL_PARAMS.dateOnly) === "1",
    placeProviderId: place && UUID_RE.test(place) ? place : null,
  };
};

/** The periods page, or a sheet over it: `periods`, `periods/new`, `periods/<id>/edit`. */
const isPageOrSheet = (groupId: string, pathname: string) => {
  const base = appUrls.periods(groupId);
  if (pathname === base || pathname === `${base}/new`) return true;
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length + 1).split("/");
  return rest.length === 2 && rest[0] !== "" && rest[1] === "edit";
};

/**
 * True when a navigation only opens or closes a sheet over the periods page:
 * the page keeps what it loaded (its live query follows every change anyway).
 */
export const onlyPeriodSheetChanged = (groupId: string, current: URL, next: URL) =>
  current.pathname !== next.pathname &&
  isPageOrSheet(groupId, current.pathname) &&
  isPageOrSheet(groupId, next.pathname);

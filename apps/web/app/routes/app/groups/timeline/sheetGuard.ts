import type { SheetKind } from "../../../../lib/appUrls";
import type { VitalType } from "@caretook/data/schema";

import {
  appUrls,
  isSheetKind,
  isVitalType,
  VITAL_TYPE_PARAM,
  withoutSheetParams,
} from "../../../../lib/appUrls";
import { parseFilters } from "../../../../lib/timelineFilters";

// The timeline's sheet routes (`timeline/new/:kind`): which sheet a URL
// opens, or where it goes instead. Pure, so web:unit tests it; the routes'
// loaders apply it.

/** What a sheet URL shows: its sheet, or a redirect (with the timeline's filters kept). */
export type SheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** The add sheet: a new symptom, or a new vital starting with one reading's type. */
export type NewSheet = { kind: SheetKind; vitalType: VitalType | null };

/**
 * `timeline/new/:kind`: a symptom or a vital for a writer. Anything else
 * (a note or event, an unknown kind, a viewer) is the timeline, with the
 * sheet's own parameters dropped. An unknown `?type=` opens the vital sheet
 * with no type chosen.
 */
export const newSheetGuard = ({
  groupId,
  kind,
  search,
  canWrite,
}: {
  groupId: string;
  kind: string | undefined;
  search: string;
  canWrite: boolean;
}): SheetDecision<NewSheet> => {
  if (!canWrite || !isSheetKind(kind))
    return { redirect: appUrls.timeline(groupId, withoutSheetParams(search)) };
  const type = new URLSearchParams(search).get(VITAL_TYPE_PARAM);
  return { sheet: { kind, vitalType: kind === "vital" && isVitalType(type) ? type : null } };
};

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * True when a navigation only opens or closes a sheet over the timeline: it
 * stays on this group's timeline (or a sheet over it) and keeps its filters.
 * The timeline then keeps its loaded data, so "Show older" pages and the
 * scroll position survive.
 */
export const onlySheetChanged = (groupId: string, current: URL, next: URL) => {
  const base = appUrls.timeline(groupId);
  if (current.pathname === next.pathname) return false;
  if (!within(current.pathname, base) || !within(next.pathname, base)) return false;
  const [a, b] = [parseFilters(current.search), parseFilters(next.search)];
  return a.kind === b.kind && a.author === b.author;
};

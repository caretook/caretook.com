import type { SheetKind } from "../../../../lib/timeline/urls";
import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";

import { appUrls } from "../../../../lib/app-shell/appUrls";
import {
  DOSE_MEDICATION_PARAM,
  DOSE_SLOT_PARAM,
  DOSE_PASS_PARAM,
  isSheetKind,
  isVitalType,
  VITAL_TYPE_PARAM,
  withoutSheetParams,
} from "../../../../lib/timeline/urls";
import { canHaveNoteDocument, isSystemWrittenKind, scheduleTimeZSchema } from "@caretook/data/schema";
import { DAY_PARAM, parseFilters } from "../../../../lib/timeline/timelineFilters";

// The timeline's sheet routes (`timeline/new/:kind`, `timeline/new/dose`, `timeline/:entryId/edit`): which sheet a URL
// opens, or where it goes instead. Pure, so web:unit tests it; the routes'
// loaders apply it.

/** What a sheet URL shows: its sheet, or a redirect (with the timeline's filters kept). */
export type SheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** The add sheet: a new symptom, or a new vital starting with one reading's type. */
export type NewSheet = { kind: SheetKind; vitalType: VitalType | null };

/**
 * `timeline/new/:kind`: a symptom or a vital for someone who logs care
 * (writers and an Easy helper). Anything else (a note or event, an unknown
 * kind, a viewer or Easy viewer) is the timeline, with the
 * sheet's own parameters dropped. An unknown `?type=` opens the vital sheet
 * with no type chosen.
 */
export const newSheetGuard = ({
  groupId,
  kind,
  search,
  canLog,
}: {
  groupId: string;
  kind: string | undefined;
  search: string;
  /** The group context's `canLog`. */
  canLog: boolean;
}): SheetDecision<NewSheet> => {
  if (!canLog || !isSheetKind(kind))
    return { redirect: appUrls.timeline(groupId, withoutSheetParams(search)) };
  const type = new URLSearchParams(search).get(VITAL_TYPE_PARAM);
  return { sheet: { kind, vitalType: kind === "vital" && isVitalType(type) ? type : null } };
};

/** What the edit guard needs to know about the entry, as read from the device. */
export type EditSheetEntry = {
  id: string;
  groupId: string;
  kind: TimelineEntryKind;
  deletedAt: string | null;
};

/**
 * `timeline/:entryId/edit`: a symptom, vital or dose in this group, for
 * someone who may change it (`canChangeEntry`: writers any, an Easy helper
 * their own). A note or event has its own page (for viewers too); a
 * medication change is never edited; a missing, deleted or other group's
 * entry, or anyone else, is the timeline. Redirects keep the timeline's filters.
 */
export const editSheetGuard = <Entry extends EditSheetEntry>({
  groupId,
  entry,
  search,
  canChange,
}: {
  groupId: string;
  entry: Entry | null;
  search: string;
  /** Whether you may change this entry (`canChangeEntry`). */
  canChange: boolean;
}): SheetDecision<{ entry: Entry }> => {
  const timeline = { redirect: appUrls.timeline(groupId, withoutSheetParams(search)) };
  if (!entry || entry.groupId !== groupId || entry.deletedAt) return timeline;
  if (canHaveNoteDocument(entry.kind)) return { redirect: appUrls.entry(groupId, entry.id) };
  if (!canChange || isSystemWrittenKind(entry.kind)) return timeline;
  return { sheet: { entry } };
};

const PASS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Dose sheet: the medication to start on and the slot the dose answers,
 * and the pass to show first, when the URL names them.
 */
export type NewDoseSheet = { medicationId: string | null; slot: string | null; passId: string | null };

/**
 * `timeline/new/dose`: someone who logs care (writers and an Easy helper)
 * logging a dose. Anyone else is the timeline
 * (filters kept, the sheet's own parameters dropped). `?medication=` that
 * isn't one of the sheet's choices (`choiceIds`) and a `?slot=` that isn't a
 * time are dropped.
 */
export const newDoseGuard = ({
  groupId,
  search,
  canLog,
  choiceIds,
}: {
  groupId: string;
  search: string;
  /** The group context's `canLog`. */
  canLog: boolean;
  choiceIds: readonly string[];
}): SheetDecision<NewDoseSheet> => {
  if (!canLog) return { redirect: appUrls.timeline(groupId, withoutSheetParams(search)) };
  const params = new URLSearchParams(search);
  const medicationId = params.get(DOSE_MEDICATION_PARAM);
  const slot = params.get(DOSE_SLOT_PARAM);
  const passId = params.get(DOSE_PASS_PARAM);
  return {
    sheet: {
      medicationId: medicationId && choiceIds.includes(medicationId) ? medicationId : null,
      slot: slot && scheduleTimeZSchema.safeParse(slot).success ? slot : null,
      // Only id-shaped: the sheet shows it when it's one of today's passes.
      passId: passId && PASS_ID.test(passId) ? passId.toLowerCase() : null,
    },
  };
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
  const dayOf = (url: URL) => url.searchParams.get(DAY_PARAM);
  return (
    a.kind === b.kind &&
    a.author === b.author &&
    a.vital === b.vital &&
    a.symptoms.join(",") === b.symptoms.join(",") &&
    dayOf(current) === dayOf(next)
  );
};

import type { TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { Search } from "../core/urls";

import { VITAL_TYPES } from "@caretook/data/schema";
import { groupHome, searchString, segment } from "../core/urls";

/** The kinds added in a sheet over the timeline (notes and events have a page: `newEntry`). */
export const SHEET_KINDS = ["symptom", "vital"] as const satisfies readonly TimelineEntryKind[];
export type SheetKind = (typeof SHEET_KINDS)[number];
export const isSheetKind = (value: unknown): value is SheetKind =>
  (SHEET_KINDS as readonly unknown[]).includes(value);

/** A new vital's first reading: `?type=heartRate`. */
export const VITAL_TYPE_PARAM = "type";
export const isVitalType = (value: unknown): value is VitalType =>
  (VITAL_TYPES as readonly unknown[]).includes(value);

/** The Dose sheet's medication and the slot it answers: `?medication=<id>&slot=08:00`. */
export const DOSE_MEDICATION_PARAM = "medication";
export const DOSE_SLOT_PARAM = "slot";
/** The Dose sheet's pass, shown first (with Given all): `?pass=<passId>`. */
export const DOSE_PASS_PARAM = "pass";

/** A new entry's starting time, from a past day's + on the timeline: `?at=<ISO>`. */
export const START_AT_PARAM = "at";
/** The `?at=` time as an ISO string, or null when it's missing or not a time (the form then starts at now). */
export const startAtFrom = (search?: Search): string | null => {
  const value = new URLSearchParams(searchString(search)).get(START_AT_PARAM);
  if (!value) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
};

/** `search` without the add sheets' own parameters: the timeline's filters, as a sheet carries them. */
export const withoutSheetParams = (search?: Search) => {
  const params = new URLSearchParams(searchString(search));
  params.delete(VITAL_TYPE_PARAM);
  params.delete(DOSE_MEDICATION_PARAM);
  params.delete(DOSE_SLOT_PARAM);
  params.delete(DOSE_PASS_PARAM);
  params.delete(START_AT_PARAM);
  return params;
};

export const timelineUrls = {
  /** A group's timeline, with its filters (`?kind=`, `?author=`) carried through. */
  timeline: (groupId: string, search?: Search) => `${groupHome(groupId)}/timeline${searchString(search)}`,
  /**
   * The add sheet over a group's timeline, carrying the timeline's filters.
   * A vital can start with a reading's `type`; an unknown type, or a type on
   * a symptom, is dropped. An unknown kind is the timeline itself. `at`
   * (an ISO time) starts the form at that time.
   */
  newSheet: (
    groupId: string,
    kind: SheetKind,
    { type, search, at }: { type?: VitalType; search?: Search; at?: string } = {},
  ) => {
    const params = withoutSheetParams(search);
    if (!isSheetKind(kind)) return `${groupHome(groupId)}/timeline${searchString(params)}`;
    if (kind === "vital" && isVitalType(type)) params.set(VITAL_TYPE_PARAM, type);
    if (at) params.set(START_AT_PARAM, at);
    return `${groupHome(groupId)}/timeline/new/${kind}${searchString(params)}`;
  },
  /**
   * The edit sheet for a symptom or vital over a group's timeline, carrying
   * the timeline's filters (the add sheet's own `type` is dropped).
   */
  editSheet: (groupId: string, entryId: string, { search }: { search?: Search } = {}) =>
    `${groupHome(groupId)}/timeline/${segment(entryId)}/edit${searchString(withoutSheetParams(search))}`,
  /**
   * The Dose sheet over a group's timeline, carrying the timeline's filters.
   * It can start on one medication, and the slot the dose answers ("08:00"),
   * and at `at` (an ISO time).
   */
  newDose: (
    groupId: string,
    {
      medicationId,
      slot,
      passId,
      search,
      at,
    }: { medicationId?: string; slot?: string; passId?: string; search?: Search; at?: string } = {},
  ) => {
    const params = withoutSheetParams(search);
    if (medicationId) params.set(DOSE_MEDICATION_PARAM, medicationId);
    if (slot) params.set(DOSE_SLOT_PARAM, slot);
    if (passId) params.set(DOSE_PASS_PARAM, passId);
    if (at) params.set(START_AT_PARAM, at);
    return `${groupHome(groupId)}/timeline/new/dose${searchString(params)}`;
  },
  /** The pass sheet over a group's timeline: one pass log's doses, carrying the timeline's filters. */
  passSheet: (groupId: string, passLogId: string, { search }: { search?: Search } = {}) =>
    `${groupHome(groupId)}/timeline/pass/${segment(passLogId)}/edit${searchString(withoutSheetParams(search))}`,
} as const;

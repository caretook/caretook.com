import type { CarePeriodType } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";

import { isCarePeriodType } from "@caretook/data/schema";
import {
  Ambulance,
  Armchair,
  Brain,
  Building2,
  HandHeart,
  Hospital,
  House,
  HousePlus,
  MapPin,
  Activity,
} from "lucide-react";

// Care periods in words: the one home for how a period, the current-period
// line, a timeline marker and a length read. Pure (no React or database);
// web:unit tests it. Times and days are in the recipient's zone.

type TypeMeta = {
  /** The form's choice: "Rehab or skilled nursing". */
  label: string;
  /** Short, for markers and lists: "Rehab". */
  short: string;
  /** Where the recipient is: "In rehab". */
  now: string;
  icon: LucideIcon;
};

export const PERIOD_TYPE_META: Record<CarePeriodType, TypeMeta> = {
  home: { label: "Home", short: "Home", now: "At home", icon: House },
  emergency: {
    label: "Emergency room or observation",
    short: "Emergency room",
    now: "In the emergency room",
    icon: Ambulance,
  },
  hospital: { label: "Hospital", short: "Hospital", now: "In hospital", icon: Hospital },
  rehab: { label: "Rehab or skilled nursing", short: "Rehab", now: "In rehab", icon: Activity },
  assistedLiving: {
    label: "Assisted living",
    short: "Assisted living",
    now: "In assisted living",
    icon: Building2,
  },
  memoryCare: { label: "Memory care", short: "Memory care", now: "In memory care", icon: Brain },
  nursingHome: { label: "Nursing home", short: "Nursing home", now: "In a nursing home", icon: Armchair },
  hospiceHome: {
    label: "Hospice at home",
    short: "Hospice at home",
    now: "In hospice at home",
    icon: HousePlus,
  },
  hospiceFacility: {
    label: "Hospice facility",
    short: "Hospice facility",
    now: "In a hospice facility",
    icon: HandHeart,
  },
  other: { label: "Other", short: "Other", now: "Elsewhere", icon: MapPin },
};

/** A type's wording and icon; a type this build doesn't know reads as Other. */
export const periodTypeMeta = (type: string) => PERIOD_TYPE_META[isCarePeriodType(type) ? type : "other"];

/** What the wording needs from a period. */
export type PeriodWords = { type: string; label: string | null };

/**
 * A period's name: its short type, or for Other its label ("Daughter's
 * house"). The label otherwise goes beside it (`periodTitle`).
 */
export const periodName = ({ type, label }: PeriodWords) =>
  periodTypeMeta(type) === PERIOD_TYPE_META.other && label ? label : periodTypeMeta(type).short;

/** A period's heading: "Hospital · Cardiac unit", or Other's label alone. */
export const periodTitle = (period: PeriodWords) => {
  const name = periodName(period);
  return period.label && period.label !== name ? `${name} · ${period.label}` : name;
};

/** Where the recipient is now: "In hospital", or Other's label. */
export const nowText = (period: PeriodWords) =>
  periodTypeMeta(period.type) === PERIOD_TYPE_META.other && period.label
    ? period.label
    : periodTypeMeta(period.type).now;

export const dayText = (day: number) => `day ${day}`;

/**
 * The current-period line: "In hospital · Mercy General · day 4". The place's
 * name when there is one, else the label (Other's label is already its name).
 * A null `day` leaves the number out.
 */
export const currentLineText = (
  period: PeriodWords,
  { placeName, day }: { placeName?: string | null; day: number | null },
) => {
  const isOther = periodTypeMeta(period.type) === PERIOD_TYPE_META.other;
  const where = placeName || (isOther ? null : period.label);
  return [nowText(period), where, day === null ? null : dayText(day)].filter(Boolean).join(" · ");
};

// ---------------------------------------------------------------------------
// Times and days, in the recipient's zone
// ---------------------------------------------------------------------------

const formats = new Map<string, Intl.DateTimeFormat>();
const format = (key: string, options: Intl.DateTimeFormatOptions) => {
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", options);
    formats.set(key, f);
  }
  return f;
};

/** "14:20" in the zone. */
export const timeText = (iso: string, timeZone: string) =>
  format(`t:${timeZone}`, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );

const yearOf = (instant: string | number | Date, timeZone: string) =>
  format(`y:${timeZone}`, { timeZone, year: "numeric" }).format(new Date(instant));

/** "Nov 12", with the year when it isn't `now`'s ("Nov 12, 2025"). */
export const dateText = (iso: string, timeZone: string, now: Date) => {
  const withYear = yearOf(iso, timeZone) !== yearOf(now, timeZone);
  return format(`d:${timeZone}:${withYear}`, {
    timeZone,
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  }).format(new Date(iso));
};

/** A start: "Nov 12, 14:20", or "Nov 12" for a date-only start. */
export const startText = (startedAt: string, dateOnly: boolean, timeZone: string, now: Date) =>
  dateOnly
    ? dateText(startedAt, timeZone, now)
    : `${dateText(startedAt, timeZone, now)}, ${timeText(startedAt, timeZone)}`;

/** Where a span ends on the periods page: "until Nov 20" (a date, like the next start shows it), or "now". */
export const untilText = (endsAt: string | null, timeZone: string, now: Date) =>
  endsAt ? `until ${dateText(endsAt, timeZone, now)}` : "now";

/** A length in calendar days: "Less than a day", "1 day", "9 days", "3 weeks", "4 months". */
export const lengthText = (days: number) => {
  if (days < 1) return "Less than a day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30);
  return months < 24 ? `${months} months` : `${Math.floor(days / 365)} years`;
};

// ---------------------------------------------------------------------------
// Timeline markers
// ---------------------------------------------------------------------------

export type MarkerWords = {
  /** The period before (null for the first period). */
  from: PeriodWords | null;
  to: PeriodWords & { dateOnly: boolean; startedAt: string };
  placeName?: string | null;
  placeDetail?: string | null;
};

/** "Mercy General, room 412": the place and its detail (the detail as written, after the first comma). */
const placeText = ({ placeName, placeDetail, to }: MarkerWords) => {
  const name = placeName || (periodTypeMeta(to.type) === PERIOD_TYPE_META.other ? null : to.label);
  const detail = placeDetail ? placeDetail.charAt(0).toLowerCase() + placeDetail.slice(1) : null;
  return [name, detail].filter(Boolean).join(", ") || null;
};

/** A marker row: "Home → Hospital · Mercy General, room 412 · 14:20", or "Started: Home" for the first. A date-only start has no time. */
export const markerText = (marker: MarkerWords, timeZone: string) => {
  const head = marker.from
    ? `${periodName(marker.from)} → ${periodName(marker.to)}`
    : `Started: ${periodName(marker.to)}`;
  const time = marker.to.dateOnly ? null : timeText(marker.to.startedAt, timeZone);
  return [head, placeText(marker), time].filter(Boolean).join(" · ");
};

/** The marker as one sentence for screen readers: "Moved from Home to Hospital, Mercy General, at 14:20". */
export const markerSentence = (marker: MarkerWords, timeZone: string) => {
  const place = placeText(marker);
  const where = place ? `, ${place}` : "";
  const when = marker.to.dateOnly ? "" : `${place ? "," : ""} at ${timeText(marker.to.startedAt, timeZone)}`;
  return marker.from
    ? `Moved from ${periodName(marker.from)} to ${periodName(marker.to)}${where}${when}`
    : `Started: ${periodName(marker.to)}${where}${when}`;
};

// ---------------------------------------------------------------------------
// Suggestions from events
// ---------------------------------------------------------------------------

/** The entry page's offer: "Start a hospital period?", "Start an emergency room period?". */
export const suggestionText = (type: string) => {
  const name = periodTypeMeta(type).short.toLowerCase();
  return `Start ${/^[aeiou]/.test(name) ? "an" : "a"} ${name} period?`;
};

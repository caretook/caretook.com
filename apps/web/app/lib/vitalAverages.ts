import type { UnitChoices, VitalFieldSpec, VitalReading, VitalType } from "@caretook/data/schema";

import { fieldUnitLabel, toDisplay, VITALS } from "@caretook/data/schema";
import { addDays, dayInZone, startOfDay } from "./zonedDay";

// Recent vital averages (the profile page, B-100): for a fixed core set of
// vital types, the average and reading count over the last 7 and 30 days.
// Pure; web:unit tests it. The device's readings come from
// `lib/sync/vitalAverages.ts`.

/** The core types, in the order the profile shows them. */
export const AVERAGE_VITALS = [
  "bloodPressure",
  "heartRate",
  "temperature",
  "weight",
  "spo2",
  "bloodGlucose",
] as const satisfies readonly VitalType[];

/** The windows, in days, newest first: today and the 6 (or 29) days before it. */
export const AVERAGE_WINDOWS = [7, 30] as const;
export const LONGEST_WINDOW = Math.max(...AVERAGE_WINDOWS);

/** One reading with when it was taken (ISO 8601), and its entry's deletion, if any. */
export type DatedReading = { occurredAt: string; deletedAt?: string | null; reading: VitalReading };

export type WindowAverage = {
  days: number;
  count: number;
  /** The average in the user's units, rounded as the timeline shows readings ("128/82", "98.4"); null with no readings. */
  value: string | null;
};

export type VitalAverageRow = {
  type: (typeof AVERAGE_VITALS)[number];
  label: string;
  /** "mmHg", "°F", "%"… */
  unit: string;
  windows: WindowAverage[];
};

/**
 * The moment a `days`-day window starts: the start of the day `days - 1`
 * days before today, in the recipient's zone. Windows end now.
 */
export const windowStart = (now: Date, timeZone: string, days: number) =>
  startOfDay(addDays(dayInZone(now, timeZone), -(days - 1)), timeZone);

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** A canonical value in the user's unit, rounded like a reading on the timeline. */
const shown = (field: VitalFieldSpec, value: number, units: UnitChoices) => {
  const display = toDisplay(field, value, units);
  // A fixed-unit field (mmHg, bpm, %): whole numbers when readings are, else tenths.
  const rounded = typeof field.unit === "object" ? roundTo(display, field.integer ? 0 : 1) : display;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** The numbers each type's average is over: BP's two, everyone else's one. */
const fieldValues = (reading: VitalReading): number[] | null => {
  switch (reading.type) {
    case "bloodPressure":
      return [reading.systolic, reading.diastolic];
    case "heartRate":
    case "temperature":
    case "weight":
    case "spo2":
    case "bloodGlucose":
      return [reading.value];
    default:
      return null;
  }
};

/**
 * The core types' averages over each window, in `AVERAGE_VITALS` order, or
 * null when none of them has a reading in the longest window (the profile
 * then hides the region). Readings after `now`, before the longest window or
 * on deleted entries don't count.
 */
export const vitalAverages = (
  readings: DatedReading[],
  { now, timeZone, units }: { now: Date; timeZone: string; units: UnitChoices },
): VitalAverageRow[] | null => {
  const end = now.getTime();
  const starts = AVERAGE_WINDOWS.map((days) => ({ days, from: windowStart(now, timeZone, days).getTime() }));
  // Per type, per window: each field's values.
  const sums = new Map<VitalType, number[][][]>();
  let any = false;
  for (const { occurredAt, deletedAt, reading } of readings) {
    if (deletedAt) continue;
    const at = Date.parse(occurredAt);
    if (Number.isNaN(at) || at > end) continue;
    if (!(AVERAGE_VITALS as readonly string[]).includes(reading.type)) continue;
    const values = fieldValues(reading);
    if (!values || values.some((v) => typeof v !== "number" || !Number.isFinite(v))) continue;
    let perWindow = sums.get(reading.type);
    if (!perWindow) sums.set(reading.type, (perWindow = starts.map(() => values.map(() => []))));
    starts.forEach(({ from }, w) => {
      if (at < from) return;
      any = true;
      values.forEach((v, f) => perWindow[w]![f]!.push(v));
    });
  }
  if (!any) return null;

  return AVERAGE_VITALS.map((type) => {
    const spec = VITALS[type];
    const perWindow = sums.get(type);
    return {
      type,
      label: spec.label,
      unit: fieldUnitLabel(spec.fields[0]!, units),
      windows: starts.map(({ days }, w) => {
        const fields = perWindow?.[w] ?? [];
        const count = fields[0]?.length ?? 0;
        const value = count
          ? fields.map((values, f) => shown(spec.fields[f]!, average(values), units)).join("/")
          : null;
        return { days, count, value };
      }),
    };
  });
};

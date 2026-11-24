import type { VitalType } from "@caretook/data/schema";

import { symptomKey, VITAL_TYPES } from "@caretook/data/schema";
import { addDays, dayInZone, timeInZone, zonedInstant } from "../core/zonedDay";

// Quick entry's predictions: what the group usually logs around this hour,
// offered under the box as chips that fill it with a keyword and wait for
// the rest (numbers, a name). Pure; web:unit tests it, and
// `lib/assistant/quickEntrySuggestions.sync.ts` reads the entries.

/** How far either side of this time of day an entry counts. */
export const USUAL_WINDOW_MINUTES = 60;
/** How many days back are looked at (not counting today). */
export const USUAL_DAYS = 14;
/** On how many of those days something must have been logged near this time. */
export const USUAL_MIN_DAYS = 3;
/** At most this many chips. */
export const USUAL_LIMIT = 4;

/** An entry as the predictions read it: its kind, when, and its details (a symptom's name, a vital's readings). */
export type PredictionEntry = { kind: string; occurredAt: string; details: unknown };

/** A chip: what it says, and what it puts in the box (always ending in a space, waiting for the rest). */
export type UsualSuggestion = { key: string; label: string; fill: string; days: number };

/** The word each vital type starts a line with (the parser's shortest keyword). */
export const VITAL_KEYWORDS: Record<VitalType, string> = {
  bloodPressure: "bp",
  heartRate: "hr",
  temperature: "temp",
  spo2: "o2",
  respiratoryRate: "rr",
  weight: "weight",
  bloodGlucose: "sugar",
  bowelMovement: "bm",
  urineOutput: "urine",
  sleep: "slept",
};

const isVitalType = (type: unknown): type is VitalType =>
  typeof type === "string" && (VITAL_TYPES as readonly string[]).includes(type);

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

/** The vital types an entry's readings have. */
const vitalTypesOf = (details: unknown): VitalType[] => {
  const readings = record(details)?.readings;
  if (!Array.isArray(readings)) return [];
  return readings.map((r) => record(r)?.type).filter(isVitalType);
};

const symptomNameOf = (details: unknown) => {
  const name = record(details)?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

/** The keys an entry counts for, in the order chips are shown when they tie. */
const ORDER = [...VITAL_TYPES.map((t) => `vital:${t}`), "symptom", "dose", "note"];

const MINUTE = 60_000;

/**
 * What the group usually logs around `now`'s time of day, in the recipient's
 * `timeZone`: each vital type, symptoms, doses and notes logged within an
 * hour either side of this time on at least 3 of the 14 days before today
 * (wall-clock time, so a DST change doesn't shift it). Most days first, at
 * most four. A vital fills its keyword (`bp `); a symptom the name used most
 * (`pain `); a dose `gave `; a note `n: `. Nothing here saves.
 */
export function usualAtHour(
  entries: readonly PredictionEntry[],
  now: Date,
  timeZone: string,
  limit = USUAL_LIMIT,
): UsualSuggestion[] {
  const today = dayInZone(now, timeZone);
  const time = timeInZone(now, timeZone);
  const windows = Array.from({ length: USUAL_DAYS }, (_, i) => {
    const day = addDays(today, -(i + 1));
    const at = zonedInstant(day, time, timeZone).getTime();
    return { day, from: at - USUAL_WINDOW_MINUTES * MINUTE, to: at + USUAL_WINDOW_MINUTES * MINUTE };
  });
  const dayOf = (iso: string) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return windows.find((w) => t >= w.from && t <= w.to)?.day ?? null;
  };

  const days = new Map<string, Set<string>>();
  const symptomNames = new Map<string, { name: string; count: number; last: number }>();
  const count = (key: string, day: string) => {
    let set = days.get(key);
    if (!set) days.set(key, (set = new Set()));
    set.add(day);
  };

  for (const entry of entries) {
    const day = dayOf(entry.occurredAt);
    if (!day) continue;
    if (entry.kind === "vital") {
      for (const type of vitalTypesOf(entry.details)) count(`vital:${type}`, day);
    } else if (entry.kind === "symptom") {
      count("symptom", day);
      const name = symptomNameOf(entry.details);
      if (!name) continue;
      const key = symptomKey(name);
      const at = Date.parse(entry.occurredAt);
      const seen = symptomNames.get(key);
      if (!seen) symptomNames.set(key, { name, count: 1, last: at });
      else {
        seen.count += 1;
        if (at > seen.last) Object.assign(seen, { name, last: at });
      }
    } else if (entry.kind === "dose" || entry.kind === "note") {
      count(entry.kind, day);
    }
  }

  const topSymptom = [...symptomNames.values()].sort((a, b) => b.count - a.count || b.last - a.last)[0];
  const suggestion = (key: string, n: number): UsualSuggestion | null => {
    if (key.startsWith("vital:")) {
      const word = VITAL_KEYWORDS[key.slice("vital:".length) as VitalType];
      return { key, label: word, fill: `${word} `, days: n };
    }
    if (key === "symptom") {
      const name = topSymptom?.name.toLowerCase() ?? "s:";
      return { key, label: topSymptom ? name : "symptom", fill: `${name} `, days: n };
    }
    if (key === "dose") return { key, label: "gave", fill: "gave ", days: n };
    if (key === "note") return { key, label: "note", fill: "n: ", days: n };
    return null;
  };

  return [...days.entries()]
    .filter(([, set]) => set.size >= USUAL_MIN_DAYS)
    .sort(([a, x], [b, y]) => y.size - x.size || ORDER.indexOf(a) - ORDER.indexOf(b))
    .map(([key, set]) => suggestion(key, set.size))
    .filter((s): s is UsualSuggestion => s !== null)
    .slice(0, Math.max(0, limit));
}

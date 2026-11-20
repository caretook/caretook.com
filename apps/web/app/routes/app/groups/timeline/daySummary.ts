import type { UnitChoices, VitalFieldSpec, VitalReading, VitalType } from "@caretook/data/schema";
import type { TimelineEntry } from "../../../../lib/rpc";

import {
  fieldUnitLabel,
  isKnownReading,
  isUnusual,
  toDisplay,
  VITAL_TYPES,
  VITALS,
} from "@caretook/data/schema";
import { dayKeyIn } from "./timelineDays";

// The one line under each day's heading on the timeline: how the day went,
// from its entries and the 7 days before it. Pure, so web:unit tests it; the
// visible text and the screen-reader wording both come from here.

/** What a summary reads from an entry (a `TimelineEntry` has all of it). */
export type SummaryEntry = Pick<
  TimelineEntry,
  "kind" | "occurredAt" | "title" | "details" | "createdBy" | "cancelledAt"
>;

export type DaySummaryContext = {
  /** The viewer's units, for the vitals' ranges. */
  units: UnitChoices;
  /** A member's name ("Former member" for someone who left). */
  nameOf: (userId: string) => string;
};

export type SummaryDirection = "up" | "down";

/** One piece of the line: "BP 128–141/80–88" with ↑, "Pain 6 (new)", "Fell in bathroom", "Ann, Sam". */
export type SummaryPart = {
  kind: "vital" | "symptom" | "event" | "authors";
  /** The visible text, without the arrow. */
  text: string;
  /** A vital's arrow, when it's above or below the last 7 days, or in the unusual band. */
  direction?: SummaryDirection;
  /** The arrow in words, for screen readers ("higher than last week"). */
  directionLabel?: string;
  /** Stands out, so the highlights line shows it: a vital with an arrow, a new or severe symptom, an event. */
  highlight?: true;
};

/** One line of the expanded summary: "Vitals: BP …, HR …". */
export type SummaryLine = { label: string; parts: SummaryPart[] };

/**
 * `parts` is the full line, `highlights` the parts that stand out (the
 * default line), `lines` the expanded breakdown.
 */
export type DaySummary = { parts: SummaryPart[]; highlights: SummaryPart[]; lines: SummaryLine[] };

export const ARROW: Record<SummaryDirection, string> = { up: "↑", down: "↓" };

const DIRECTION_LABEL = {
  week: { up: "higher than last week", down: "lower than last week" },
  unusual: { up: "unusually high", down: "unusually low" },
} as const;

/** Types summarised by a count rather than a trend (no typical range, values often blank). */
const COUNTED: readonly VitalType[] = ["bowelMovement", "urineOutput"];

const EMPTY: DaySummary = { parts: [], highlights: [], lines: [] };

/** A symptom this severe (0–10) or worse is a highlight even when it isn't new. */
export const SEVERE_SYMPTOM = 5;

const fold = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

const readingsOf = (entry: SummaryEntry): VitalReading[] => {
  if (entry.kind !== "vital") return [];
  const readings = (entry.details as { readings?: unknown } | null)?.readings;
  return Array.isArray(readings)
    ? (readings as { type: string }[]).filter((r): r is VitalReading => !!r && isKnownReading(r))
    : [];
};

const symptomOf = (entry: SummaryEntry) => {
  if (entry.kind !== "symptom") return null;
  const details = entry.details as { name?: unknown; severity?: unknown } | null;
  if (typeof details?.name !== "string" || !details.name.trim()) return null;
  return {
    name: details.name.trim().replace(/\s+/g, " "),
    severity: typeof details.severity === "number" ? details.severity : null,
  };
};

/** A reading's value for one field, canonical, or null when it's blank. */
const valueOf = (reading: VitalReading, key: VitalFieldSpec["key"]): number | null => {
  const value = (reading as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
};

type Span = { min: number; max: number };
const widen = (span: Span | undefined, value: number): Span =>
  span ? { min: Math.min(span.min, value), max: Math.max(span.max, value) } : { min: value, max: value };

/** Each field's span over some readings of one type. */
const spansOf = (type: VitalType, readings: VitalReading[]) => {
  const spans = new Map<VitalFieldSpec["key"], Span>();
  for (const reading of readings)
    for (const field of VITALS[type].fields) {
      const value = valueOf(reading, field.key);
      if (value != null) spans.set(field.key, widen(spans.get(field.key), value));
    }
  return spans;
};

const shown = (field: VitalFieldSpec, value: number, units: UnitChoices) =>
  toDisplay(field, value, units).toLocaleString("en-US", { maximumFractionDigits: 1 });

const rangeText = (field: VitalFieldSpec, span: Span, units: UnitChoices) => {
  const min = shown(field, span.min, units);
  const max = shown(field, span.max, units);
  return min === max ? min : `${min}–${max}`;
};

const withUnit = (text: string, unit: string) =>
  unit === "" ? text : unit === "%" || unit.startsWith("/") ? `${text}${unit}` : `${text} ${unit}`;

/**
 * The arrow for one type: the unusual band first (any reading outside the
 * typical range), else the day against the previous 7 days' span (above it
 * and not below, or the other way round). None when it's within both.
 */
const directionOf = (
  type: VitalType,
  day: Map<VitalFieldSpec["key"], Span>,
  baseline: Map<VitalFieldSpec["key"], Span>,
): Pick<SummaryPart, "direction" | "directionLabel"> => {
  if (COUNTED.includes(type)) return {};
  const fields = VITALS[type].fields;
  const high = fields.some((f) => {
    const span = day.get(f.key);
    return !!span && !!f.typical && isUnusual(f, span.max) && span.max > f.typical.max;
  });
  const low = fields.some((f) => {
    const span = day.get(f.key);
    return !!span && !!f.typical && isUnusual(f, span.min) && span.min < f.typical.min;
  });
  if (high !== low) {
    const direction = high ? "up" : "down";
    return { direction, directionLabel: DIRECTION_LABEL.unusual[direction] };
  }
  if (!baseline.size) return {};
  let above = false;
  let below = false;
  for (const f of fields) {
    const span = day.get(f.key);
    const before = baseline.get(f.key);
    if (!span || !before) continue;
    if (span.max > before.max) above = true;
    if (span.min < before.min) below = true;
  }
  if (above === below) return {};
  const direction = above ? "up" : "down";
  return { direction, directionLabel: DIRECTION_LABEL.week[direction] };
};

const vitalPart = (
  type: VitalType,
  readings: VitalReading[],
  baseline: VitalReading[],
  units: UnitChoices,
): SummaryPart => {
  const spec = VITALS[type];
  const day = spansOf(type, readings);
  const count = readings.length > 1 ? ` ×${readings.length}` : "";
  let text: string;
  if (type === "bloodPressure") {
    const [sys, dia] = spec.fields as [VitalFieldSpec, VitalFieldSpec];
    text = `${spec.short} ${rangeText(sys, day.get("systolic")!, units)}/${rangeText(dia, day.get("diastolic")!, units)}`;
  } else if (COUNTED.includes(type)) {
    const field = spec.fields[0]!;
    const span = day.get(field.key);
    const measured = !span
      ? ""
      : type === "bowelMovement"
        ? ` type ${rangeText(field, span, units)}`
        : ` ${withUnit(rangeText(field, span, units), fieldUnitLabel(field, units))}`;
    text = `${spec.short}${count}${measured}`;
  } else {
    const field = spec.fields[0]!;
    text = `${spec.short} ${withUnit(rangeText(field, day.get(field.key)!, units), fieldUnitLabel(field, units))}`;
  }
  const direction = directionOf(type, day, spansOf(type, baseline));
  return { kind: "vital", text, ...direction, ...(direction.direction && { highlight: true as const }) };
};

const byType = (entries: SummaryEntry[]) => {
  const map = new Map<VitalType, VitalReading[]>();
  for (const entry of entries)
    for (const reading of readingsOf(entry))
      map.set(reading.type, [...(map.get(reading.type) ?? []), reading]);
  return map;
};

/** First names, unless two authors share one (then their full names). */
const shortNames = (names: string[]) => {
  const first = names.map((n) => (n === "Former member" ? n : (n.trim().split(/\s+/)[0] ?? n)));
  return first.map((f, i) => (first.indexOf(f) !== first.lastIndexOf(f) ? names[i]! : f));
};

/** Oldest first: the entries come newest first, and the line reads like the day. */
const oldestFirst = (entries: SummaryEntry[]) =>
  [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

/**
 * One day's summary from its entries and the 7 days before it: each measured
 * vital type's range, with an arrow when it's in the unusual band or above or
 * below the baseline's range; the symptoms with their highest severity,
 * "(new)" when not logged in the baseline; the events' titles (not cancelled
 * ones); and who logged (notes and doses count as logging, but aren't
 * summarised: their rows, the medication strip and pass rows cover them).
 * Highlights: vitals with an arrow, new symptoms or those of severity
 * `SEVERE_SYMPTOM` or more, and events. Nothing for a day with no vitals,
 * symptoms or events.
 */
export const daySummary = (
  dayEntries: SummaryEntry[],
  baselineEntries: SummaryEntry[],
  context: DaySummaryContext,
): DaySummary => {
  const entries = oldestFirst(dayEntries);

  const readings = byType(entries);
  const before = byType(baselineEntries);
  const vitals = VITAL_TYPES.filter((t) => readings.has(t)).map((t) =>
    vitalPart(t, readings.get(t)!, before.get(t) ?? [], context.units),
  );

  const seenBefore = new Set(baselineEntries.map(symptomOf).flatMap((s) => (s ? [fold(s.name)] : [])));
  const symptoms = new Map<string, { name: string; severity: number | null }>();
  for (const s of entries.map(symptomOf)) {
    if (!s) continue;
    const key = fold(s.name);
    const was = symptoms.get(key);
    const severity =
      was?.severity == null
        ? s.severity
        : s.severity == null
          ? was.severity
          : Math.max(was.severity, s.severity);
    // The latest spelling names it.
    symptoms.set(key, { name: s.name, severity });
  }
  const symptomParts: SummaryPart[] = [...symptoms]
    .sort(([, a], [, b]) => (b.severity ?? -1) - (a.severity ?? -1))
    .map(([key, s]): SummaryPart => {
      const isNew = !seenBefore.has(key);
      return {
        kind: "symptom",
        text: `${s.name}${s.severity == null ? "" : ` ${s.severity}`}${isNew ? " (new)" : ""}`,
        ...((isNew || (s.severity ?? 0) >= SEVERE_SYMPTOM) && { highlight: true as const }),
      };
    });

  const events: SummaryPart[] = entries
    .filter((e) => e.kind === "event" && !e.cancelledAt)
    .map((e) => ({ kind: "event", text: e.title?.trim() || "Event", highlight: true as const }));

  if (!vitals.length && !symptomParts.length && !events.length) return EMPTY;

  const authorIds = [...new Set(entries.map((e) => e.createdBy).filter(Boolean))];
  const authors: SummaryPart[] = authorIds.length
    ? [{ kind: "authors", text: shortNames(authorIds.map(context.nameOf)).join(", ") }]
    : [];

  const lines: SummaryLine[] = [
    { label: "Vitals", parts: vitals },
    { label: "Symptoms", parts: symptomParts },
    { label: "Events", parts: events },
    { label: "Logged by", parts: authors },
  ].filter((line) => line.parts.length);
  const parts = lines.flatMap((l) => l.parts);
  return { parts, highlights: parts.filter((p) => p.highlight), lines };
};

const DAY_MS = 86_400_000;

/** A day key ("2026-11-17") moved by whole calendar days; DST can't shift it. */
export const shiftDayKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** How many days before a day its baseline covers. */
export const BASELINE_DAYS = 7;

/**
 * An instant no later than the start of the baseline of the day `key` in any
 * time zone: midnight UTC a day earlier than the baseline's first day (zones
 * are at most 14 hours ahead). What the summaries' query reads from.
 */
export const baselineStart = (key: string) => `${shiftDayKey(key, -(BASELINE_DAYS + 1))}T00:00:00.000Z`;

/**
 * Each day's summary (by its key in `timeZone`, the timeline's sections),
 * from one list of entries covering those days and the 7 days before the
 * oldest (`baselineStart`).
 */
export const summariesByDay = (
  entries: SummaryEntry[],
  dayKeys: string[],
  timeZone: string,
  context: DaySummaryContext,
): Map<string, DaySummary> => {
  const byDay = new Map<string, SummaryEntry[]>();
  for (const entry of entries) {
    const key = dayKeyIn(entry.occurredAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }
  const summaries = new Map<string, DaySummary>();
  for (const key of new Set(dayKeys)) {
    const baseline = Array.from(
      { length: BASELINE_DAYS },
      (_, i) => byDay.get(shiftDayKey(key, -(i + 1))) ?? [],
    );
    summaries.set(key, daySummary(byDay.get(key) ?? [], baseline.flat(), context));
  }
  return summaries;
};

/** The whole summary as one sentence, for a test or a label: "BP 128/82 ↑ · Pain 6 (new)". */
export const summaryText = (parts: SummaryPart[]) =>
  parts.map((p) => (p.direction ? `${p.text} ${ARROW[p.direction]}` : p.text)).join(" · ");

/** The summary as screen readers hear it, the arrows in words: "BP 150/90, higher than last week; Pain 6 (new); Ann, Sam". */
export const summaryLabel = (parts: SummaryPart[]) =>
  parts.map((p) => (p.directionLabel ? `${p.text}, ${p.directionLabel}` : p.text)).join("; ");

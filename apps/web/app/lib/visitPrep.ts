import type {
  MedicationSchedule,
  MedicationStatus,
  NoteSectionLine,
  PeriodSpan,
  TrackPeriod,
  TimelineEntryDetails,
  UnitChoices,
  VitalFieldSpec,
  VitalReading,
  VitalType,
} from "@caretook/data/schema";
import type { DueDose } from "./dueDoses";
import type { SchedulePass } from "./medicationDisplay";
import type { TimedEntry } from "./upcoming";

import {
  fieldUnitLabel,
  isKnownReading,
  isMedicationChangeDetails,
  isPassMovedDetails,
  isSymptomDetails,
  isVitalDetails,
  toDisplay,
  VITAL_TYPES,
  VITALS,
} from "@caretook/data/schema";
import { doseSlotsBetween, missedDoseCounts } from "./dueDoses";
import { changeText, medicationTitle, passMovedText, scheduleText } from "./medicationDisplay";
import { dateText, periodTitle } from "./periodDisplay";
import { entryTiming } from "./upcoming";

// Visit prep: what happened since the recipient last saw a provider, as the
// lines of a dated section put at the top of an appointment's live notes
// ("Since your last visit · Oct 12 – Nov 19"). Pure, from local data, so it
// works offline. Unit-tested in web:unit.

const DAY_MS = 86_400_000;
/** With no past visit to start from, the window is the last 30 days. */
export const DEFAULT_WINDOW_DAYS = 30;

/** The heading every prepared section starts with; a document holding one has been prepared before. */
export const VISIT_PREP_HEADING = "Since your last visit";

/** An event, with the providers linked to it. */
export type VisitEvent = TimedEntry & { title: string | null; providerIds: readonly string[] };

export type VisitWindow = {
  /** ISO 8601: where the window starts (the last visit's start, or 30 days back). */
  from: string;
  /** ISO 8601: now. */
  to: string;
  /** The past visit it starts from, or null for the 30-day default. */
  lastVisit: { id: string; title: string | null; occurredAt: string } | null;
};

/**
 * The window to prepare a visit from: since the last past, not cancelled
 * event linked to any of `providerIds`, else the last 30 days. `events` may
 * hold anything (the appointment itself, other providers' events): only past
 * ones linked to these providers count.
 */
export const visitWindow = ({
  providerIds,
  events,
  now,
}: {
  providerIds: readonly string[];
  events: readonly VisitEvent[];
  now: Date;
}): VisitWindow => {
  const wanted = new Set(providerIds);
  const last = events
    .filter(
      (e) => !e.cancelledAt && entryTiming(e, now) === "past" && e.providerIds.some((id) => wanted.has(id)),
    )
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
  return {
    from: last ? last.occurredAt : new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString(),
    to: now.toISOString(),
    lastVisit: last ? { id: last.id, title: last.title, occurredAt: last.occurredAt } : null,
  };
};

// ---------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------

/** What the section reads from an entry (a `TimelineEntry` has it all). */
export type PrepEntry = {
  id: string;
  kind: string;
  occurredAt: string;
  title: string | null;
  details: TimelineEntryDetails | null;
  cancelledAt?: string | null;
};

export type PrepMedication = {
  id: string;
  name: string;
  strength: string | null;
  dose: string | null;
  status: MedicationStatus;
  schedule: MedicationSchedule;
  deletedAt: string | null;
  /** For missed doses: no slots before it was added (ISO 8601), started, or from the day it stopped ("YYYY-MM-DD"). */
  createdAt?: string | null;
  startedOn?: string | null;
  stoppedOn?: string | null;
};

export type PrepPeriod = TrackPeriod & { type: string; label: string | null; placeProviderId: string | null };

export type VisitPrepData = {
  /** Vitals, symptoms, events and medication changes from before the window (as long again) to its end. */
  entries: readonly PrepEntry[];
  /** The group's medications, deleted ones too (their changes still name them). */
  medications: readonly PrepMedication[];
  /** Medication passes, deleted ones too, for schedules. */
  passes: readonly SchedulePass[];
  /** The doses (not deleted) logged in the window, for missed doses. Left out: no missed-dose section. */
  doses?: readonly DueDose[];
  /** The care period track. */
  periods: readonly PeriodSpan<PrepPeriod>[];
  /** Provider id → name, for care periods' places. */
  placeNames: ReadonlyMap<string, string>;
  /** The appointment being prepared (left out of the events). */
  appointmentId: string;
  units: UnitChoices;
  /** The recipient's zone: dates read in it. */
  timeZone: string;
  now: Date;
};

const ms = (iso: string) => new Date(iso).getTime();
const byTime = (a: { occurredAt: string }, b: { occurredAt: string }) => ms(a.occurredAt) - ms(b.occurredAt);

/** "5 readings", "1 reading". */
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => (n === 1 ? "once" : `${n} times`);

const withUnit = (text: string, unit: string) =>
  // "97%", "18/min" attach; "98.6 °F", "74 bpm" take a space.
  unit === "" ? text : unit === "%" || unit.startsWith("/") ? `${text}${unit}` : `${text} ${unit}`;

const shown = (field: VitalFieldSpec, value: number, units: UnitChoices) =>
  toDisplay(field, value, units).toLocaleString("en-US", { maximumFractionDigits: field.integer ? 0 : 1 });

const average = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * How far the average may move (canonical units) and still read as "about
 * the same": about what a second reading moments later could differ by.
 */
const STEADY_WITHIN: Record<VitalType, number> = {
  bloodPressure: 5,
  heartRate: 5,
  temperature: 0.3,
  spo2: 1,
  respiratoryRate: 2,
  weight: 1,
  bloodGlucose: 10,
  bowelMovement: Number.POSITIVE_INFINITY,
  urineOutput: 100,
  sleep: 0.5,
};

const direction = (type: VitalType, now: number, before: number, wasText: string) => {
  const delta = now - before;
  if (Math.abs(delta) < STEADY_WITHIN[type]) return `about the same as before (${wasText})`;
  return `${delta > 0 ? "up" : "down"} from ${wasText}`;
};

type Readings<T extends VitalType> = Extract<VitalReading, { type: T }>[];

const bloodPressureLine = (now: Readings<"bloodPressure">, before: Readings<"bloodPressure">) => {
  const sys = now.map((r) => r.systolic);
  const dia = now.map((r) => r.diastolic);
  const range = (values: number[]) =>
    Math.min(...values) === Math.max(...values)
      ? `${Math.min(...values)}`
      : `${Math.min(...values)}–${Math.max(...values)}`;
  const pair = (s: number, d: number) => `${Math.round(s)}/${Math.round(d)}`;
  const parts = [
    count(now.length, "reading"),
    `${range(sys)} / ${range(dia)} mmHg`,
    `average ${pair(average(sys), average(dia))}`,
  ];
  if (before.length) {
    const was = pair(average(before.map((r) => r.systolic)), average(before.map((r) => r.diastolic)));
    parts.push(direction("bloodPressure", average(sys), average(before.map((r) => r.systolic)), was));
  }
  return parts.join(", ");
};

const bowelLine = (now: Readings<"bowelMovement">) => {
  const types = now.map((r) => r.bristol).filter((t): t is number => t != null);
  const parts = [times(now.length)];
  if (types.length) {
    const lo = Math.min(...types);
    const hi = Math.max(...types);
    parts.push(lo === hi ? `type ${lo}` : `types ${lo}–${hi}`);
  }
  return parts.join(", ");
};

const valueOf = (r: VitalReading) => ("value" in r ? r.value : null);

const measuredLine = (type: VitalType, now: VitalReading[], before: VitalReading[], units: UnitChoices) => {
  const field = VITALS[type].fields[0]!;
  const unit = fieldUnitLabel(field, units);
  const values = now.map(valueOf).filter((v): v is number => v != null);
  const parts = [count(now.length, "reading")];
  if (!values.length) return parts[0]!;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  parts.push(
    withUnit(
      lo === hi ? shown(field, lo, units) : `${shown(field, lo, units)}–${shown(field, hi, units)}`,
      unit,
    ),
    `average ${withUnit(shown(field, average(values), units), unit)}`,
  );
  const was = before.map(valueOf).filter((v): v is number => v != null);
  if (was.length) {
    const wasText = withUnit(shown(field, average(was), units), unit);
    parts.push(direction(type, average(values), average(was), wasText));
  }
  return parts.join(", ");
};

const readingsOf = (entries: readonly PrepEntry[]) =>
  entries.flatMap((e) =>
    e.kind === "vital" && isVitalDetails(e.details) ? e.details.readings.filter(isKnownReading) : [],
  );

const vitalLines = (now: readonly PrepEntry[], before: readonly PrepEntry[], units: UnitChoices) => {
  const current = readingsOf(now);
  const earlier = readingsOf(before);
  return VITAL_TYPES.flatMap((type) => {
    const these = current.filter((r) => r.type === type);
    if (!these.length) return [];
    const was = earlier.filter((r) => r.type === type);
    const text =
      type === "bloodPressure"
        ? bloodPressureLine(these as Readings<"bloodPressure">, was as Readings<"bloodPressure">)
        : type === "bowelMovement"
          ? bowelLine(these as Readings<"bowelMovement">)
          : measuredLine(type, these, was, units);
    return [`${VITALS[type].label}: ${text}`];
  });
};

const foldName = (name: string) => name.trim().toLocaleLowerCase("en-US");

const symptomLines = (now: readonly PrepEntry[], before: readonly PrepEntry[]) => {
  const seenBefore = new Set(
    before.flatMap((e) =>
      e.kind === "symptom" && isSymptomDetails(e.details) ? [foldName(e.details.name)] : [],
    ),
  );
  const groups = new Map<string, { name: string; count: number; worst: number | null }>();
  for (const e of [...now].sort(byTime)) {
    if (e.kind !== "symptom" || !isSymptomDetails(e.details)) continue;
    const key = foldName(e.details.name);
    if (!key) continue;
    const group = groups.get(key) ?? { name: e.details.name.trim(), count: 0, worst: null };
    group.count++;
    // The latest spelling names it.
    group.name = e.details.name.trim();
    const severity = e.details.severity;
    if (severity != null && (group.worst == null || severity > group.worst)) group.worst = severity;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.name.localeCompare(b.name, "en-US"))
    .map(([key, g]) =>
      [
        `${g.name}: ${times(g.count)}`,
        g.worst != null && `worst ${g.worst}/10`,
        !seenBefore.has(key) && "new",
      ]
        .filter(Boolean)
        .join(", "),
    );
};

const medicationChangeLines = (now: readonly PrepEntry[], data: VisitPrepData) => {
  const byId = new Map(data.medications.map((m) => [m.id, m]));
  return [...now].sort(byTime).flatMap((e) => {
    if (e.kind !== "medicationChange") return [];
    const day = dateText(e.occurredAt, data.timeZone, data.now);
    if (isPassMovedDetails(e.details)) return [`${passMovedText(e.details)} (${day})`];
    if (!isMedicationChangeDetails(e.details)) return [];
    const medication = byId.get(e.details.medicationId);
    const name = medication ? medicationTitle(medication) : "A medication";
    return [`${name}: ${changeText(e.details, data.passes)} (${day})`];
  });
};

const currentMedicationLines = (data: VisitPrepData) =>
  data.medications
    .filter((m) => m.status === "current" && !m.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name, "en-US", { sensitivity: "base" }))
    .map((m) =>
      [medicationTitle(m), m.dose?.trim() || null, scheduleText(m.schedule, data.passes, m.dose)]
        .filter(Boolean)
        .join(" · "),
    );

/**
 * Missed doses in the window, per medication, most first: "Metformin 500 mg:
 * 3 missed, 1 refused (of 28)". Missed is a scheduled slot nothing answered
 * by the end of its day (`doseSlotsBetween`, the slot rules of what's due);
 * skipped and refused are as logged. Today's slots still open don't count.
 */
const missedDoseLines = (window: VisitWindow, data: VisitPrepData) => {
  if (!data.doses) return [];
  const slots = doseSlotsBetween({
    medications: data.medications,
    passes: data.passes,
    doses: data.doses,
    from: window.from,
    to: window.to,
    timeZone: data.timeZone,
  });
  return missedDoseCounts(slots).map((row) => {
    const counts = [
      row.missed && `${row.missed} missed`,
      row.skipped && `${row.skipped} skipped`,
      row.refused && `${row.refused} refused`,
    ].filter(Boolean);
    return `${medicationTitle(row.medication)}: ${counts.join(", ")} (of ${row.slots})`;
  });
};

const eventLines = (now: readonly PrepEntry[], data: VisitPrepData, skip: string | null) =>
  [...now]
    .sort(byTime)
    .filter((e) => e.kind === "event" && !e.cancelledAt && e.id !== data.appointmentId && e.id !== skip)
    .map((e) => `${dateText(e.occurredAt, data.timeZone, data.now)}: ${e.title?.trim() || "Event"}`);

const periodLines = (window: VisitWindow, data: VisitPrepData) =>
  data.periods
    .filter(
      (span) =>
        span.period.type !== "home" &&
        ms(span.startsAt) < ms(window.to) &&
        (span.endsAt === null || ms(span.endsAt) > ms(window.from)),
    )
    .map((span) => {
      const place = span.period.placeProviderId ? data.placeNames.get(span.period.placeProviderId) : null;
      const name = [periodTitle(span.period), place].filter(Boolean).join(" · ");
      const start = dateText(span.startsAt, data.timeZone, data.now);
      const end = span.endsAt ? dateText(span.endsAt, data.timeZone, data.now) : "now";
      return `${name}: ${start} – ${end}`;
    });

/** The heading: "Since your last visit · Oct 12 – Nov 19", and "(updated Nov 19)" on a rerun. */
export const visitPrepHeading = (
  window: VisitWindow,
  data: Pick<VisitPrepData, "timeZone" | "now">,
  rerun: boolean,
) => {
  const range = `${dateText(window.from, data.timeZone, data.now)} – ${dateText(window.to, data.timeZone, data.now)}`;
  const updated = rerun ? ` (updated ${dateText(data.now.toISOString(), data.timeZone, data.now)})` : "";
  return `${VISIT_PREP_HEADING} · ${range}${updated}`;
};

/** Whether a document's text already holds a prepared section (so another is a rerun). */
export const hasVisitPrep = (text: string) =>
  text.split("\n").some((line) => line.startsWith(`${VISIT_PREP_HEADING} · `));

/**
 * The section for `window`, as lines for `prependNoteSection`: the heading,
 * then, each under its own subheading and left out when empty, medication
 * changes, the current medications, missed doses (with how many were
 * skipped or refused), each measured vital's range and average
 * (with its direction against the same length of time before), symptoms
 * (how often, the worst severity, "new" when absent before), events, and
 * hospital or other stays that overlap the window. With nothing in any of
 * them, one line says so.
 */
export const visitPrepSection = (
  data: VisitPrepData,
  window: VisitWindow,
  { rerun = false }: { rerun?: boolean } = {},
): NoteSectionLine[] => {
  const from = ms(window.from);
  const to = ms(window.to);
  const beforeFrom = from - (to - from);
  const inWindow = data.entries.filter((e) => ms(e.occurredAt) >= from && ms(e.occurredAt) <= to);
  const before = data.entries.filter((e) => ms(e.occurredAt) >= beforeFrom && ms(e.occurredAt) < from);

  const sections: [string, string[]][] = [
    ["Medication changes", medicationChangeLines(inWindow, data)],
    ["Current medications", currentMedicationLines(data)],
    ["Missed doses", missedDoseLines(window, data)],
    ["Vitals", vitalLines(inWindow, before, data.units)],
    ["Symptoms", symptomLines(inWindow, before)],
    ["Events", eventLines(inWindow, data, window.lastVisit?.id ?? null)],
    ["Hospital and other stays", periodLines(window, data)],
  ];
  const filled = sections.filter(([, lines]) => lines.length);
  return [
    { text: visitPrepHeading(window, data, rerun), style: "heading" },
    ...(filled.length
      ? filled.flatMap(([title, lines]): NoteSectionLine[] => [
          { text: title, style: "subheading" },
          ...lines.map((text): NoteSectionLine => ({ text, style: "bullet" })),
        ])
      : [{ text: "Nothing was logged in this time." }]),
  ];
};

import type { MedicationSchedule, MedicationStatus } from "./medication";
import type { PassLike, TimedSlot } from "./medicationPass";

import { addDays } from "../core/entryTiming";
import { dayInZone, zonedInstant } from "../core/zonedDay";
import { normalizeSchedule } from "./medication";
import { scheduleHasPass, slotTimes } from "./medicationPass";

// What a medication's schedule (and usual dose) was on a past day, read from
// its change entries: start from the present and undo each later change. Pure; the
// missed-dose range (`doseSlotsBetween`) reads every day through it.

/** A `medicationChange` entry (deleted ones count: deleting the line doesn't undo the change). */
export type ScheduleChange = {
  id: string;
  /** ISO 8601. */
  occurredAt: string;
  details?: unknown;
};

/** What the history needs of a medication. */
export type ScheduleHistoryMedication = {
  id: string;
  schedule: MedicationSchedule;
  status: MedicationStatus;
  /** The usual dose now (`slotAmount`'s fallback); left out: none. */
  dose?: string | null;
  /** ISO 8601: with history but no "started" entry, no slot before this moment. */
  createdAt?: string | null;
  /** "YYYY-MM-DD": while stopped, no slots from this day on (also when no entry records the stop). */
  stoppedOn?: string | null;
};

export type ScheduleHistoryInput = {
  medication: ScheduleHistoryMedication;
  /** The group's passes, deleted ones too, at their current times. */
  passes?: readonly Pick<PassLike, "id" | "time">[];
  /** The group's change entries from the first day asked about on, any order. */
  changes?: readonly ScheduleChange[];
  /** The recipient's IANA zone. */
  timeZone: string;
};

/** What a dose says about its slot. */
export type DoseSlotName = { passId?: string | null; scheduledFor?: string | null };

export type ScheduleHistory = {
  /** Whether it was being taken at the end of `day`. */
  takenOn: (day: string) => boolean;
  /**
   * The slots `day` has: the schedule at the end of that day, at that
   * moment's pass times, keeping a slot only if it was on the schedule at
   * its own moment. One per key.
   */
  slotsOn: (day: string) => TimedSlot[];
  /**
   * What a dose names, read at the time it was given: a time that was a
   * pass's then names that pass (so it follows the pass when it moves later
   * that day). A time the schedule has since dropped still names the slot it
   * was, when that slot is within `windowMinutes` of the dose (so a 23:30 dose
   * at 00:10 keeps last night's slot through a change at 00:05); else a time
   * its day's schedule no longer has names nothing.
   */
  doseName: (dose: { occurredAt: string; details: DoseSlotName }, windowMinutes?: number) => DoseSlotName;
  /** The usual dose at a moment (ms): the medication's dose then, as its change entries undo it. */
  doseAt: (ms: number) => string | null;
};

type State = {
  schedule: MedicationSchedule;
  passTimes: ReadonlyMap<string, string>;
  taking: boolean;
  dose: string | null;
};

type Parsed =
  | { type: "move"; ms: number; id: string; passId: string; beforeTime: string; medicationIds: unknown }
  | {
      type: "own";
      ms: number;
      id: string;
      change: string;
      before: MedicationSchedule | null;
      /** The dose before it, when the change edited the dose. */
      beforeDose?: string | null;
    };

const MINUTE = 60_000;

const record = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

/** A change entry as the history reads it, or null when it doesn't concern this medication. */
const parseChange = ({ id, occurredAt, details }: ScheduleChange, medicationId: string): Parsed | null => {
  const ms = new Date(occurredAt).getTime();
  const d = record(details);
  if (!d || Number.isNaN(ms)) return null;
  if (d.change === "passMoved") {
    if (typeof d.passId !== "string" || typeof d.beforeTime !== "string") return null;
    return {
      type: "move",
      ms,
      id,
      passId: d.passId,
      beforeTime: d.beforeTime,
      medicationIds: d.medicationIds,
    };
  }
  if (d.medicationId !== medicationId || typeof d.change !== "string") return null;
  const was = record(d.before);
  const before = was?.schedule;
  const own = {
    type: "own" as const,
    ms,
    id,
    change: d.change,
    before: before ? normalizeSchedule(before) : null,
  };
  if (!was || !("dose" in was)) return own;
  return { ...own, beforeDose: typeof was.dose === "string" ? was.dose : null };
};

/** The state just before a change, from the state just after it. */
const undo = (state: State, change: Parsed): State => {
  if (change.type === "move") {
    const passTimes = new Map(state.passTimes);
    passTimes.set(change.passId, change.beforeTime);
    return { ...state, passTimes };
  }
  const schedule = change.before ?? state.schedule;
  const dose = change.beforeDose === undefined ? state.dose : change.beforeDose;
  if (change.change === "stopped") return { ...state, schedule, dose, taking: true };
  if (change.change === "resumed" || change.change === "started")
    return { ...state, schedule, dose, taking: false };
  return { ...state, schedule, dose };
};

const timedSlots = ({ schedule, passTimes }: State) =>
  slotTimes(
    schedule,
    [...passTimes].map(([id, time]) => ({ id, time })),
  );

const sameSlot = (a: TimedSlot, b: TimedSlot) => a.time === b.time || (!!a.passId && a.passId === b.passId);

/**
 * A medication's schedule through time. With no entries about it, every day
 * reads the present schedule (and `stoppedOn`). A change no entry explains
 * reads as the state after it, back to the entry before it: never worse than
 * reading the present.
 */
export function scheduleHistory({
  medication,
  passes = [],
  changes = [],
  timeZone,
}: ScheduleHistoryInput): ScheduleHistory {
  const parsed = changes
    .flatMap((change) => parseChange(change, medication.id) ?? [])
    .sort((a, b) => b.ms - a.ms || b.id.localeCompare(a.id));
  const own = parsed.filter((c) => c.type === "own");
  const concerns = (c: Parsed) =>
    c.type === "own" ||
    scheduleHasPass(medication.schedule, c.passId) ||
    (Array.isArray(c.medicationIds) && c.medicationIds.includes(medication.id)) ||
    own.some((o) => o.before && scheduleHasPass(o.before, c.passId));
  const hasHistory = parsed.some(concerns);

  // Newest first: each state holds from its moment until the next one up.
  const stopRecorded = own.some((c) => c.change === "stopped");
  let state: State = {
    schedule: medication.schedule,
    passTimes: new Map(passes.map((p) => [p.id, p.time])),
    taking: medication.status === "current" || !stopRecorded,
    dose: medication.dose ?? null,
  };
  const spans: { from: number; state: State }[] = [];
  for (const change of parsed) {
    spans.push({ from: change.ms, state });
    state = undo(state, change);
  }
  spans.push({ from: Number.NEGATIVE_INFINITY, state });
  const stateAt = (ms: number) => spans.find((s) => s.from <= ms)?.state ?? state;

  // A "started" entry already ends the history; without one, the row's own time does.
  const created = medication.createdAt ? new Date(medication.createdAt).getTime() : Number.NaN;
  const added =
    hasHistory && !own.some((c) => c.change === "started") && !Number.isNaN(created)
      ? created
      : Number.NEGATIVE_INFINITY;

  const beforeStop = (day: string) =>
    medication.status === "current" || !medication.stoppedOn || day < medication.stoppedOn;
  const endOf = (day: string) => stateAt(zonedInstant(addDays(day, 1), "00:00", timeZone).getTime() - 1);
  const takenOn = (day: string) => beforeStop(day) && endOf(day).taking;

  const slotsOn = (day: string) => {
    if (!takenOn(day)) return [];
    const slots = timedSlots(endOf(day));
    if (!hasHistory) return slots;
    return slots.filter((slot) => {
      const at = zonedInstant(day, slot.time, timeZone).getTime();
      if (at < added) return false;
      const then = stateAt(at);
      return then.taking && timedSlots(then).some((s) => sameSlot(s, slot));
    });
  };

  /** Whether a day around `ms` really had a slot at `time` (in `passId`, when given) within the window. */
  const hadSlotNear = (ms: number, time: string, passId: string | null, windowMinutes: number) => {
    const day = dayInZone(new Date(ms), timeZone);
    return [addDays(day, -1), day, addDays(day, 1)].some((d) =>
      slotsOn(d).some(
        (s) =>
          s.time === time &&
          (!passId || s.passId === passId) &&
          Math.abs(zonedInstant(d, time, timeZone).getTime() - ms) <= windowMinutes * MINUTE,
      ),
    );
  };

  const doseName: ScheduleHistory["doseName"] = ({ occurredAt, details }, windowMinutes = 120) => {
    const ms = new Date(occurredAt).getTime();
    if (!hasHistory || !details.scheduledFor || Number.isNaN(ms)) return details;
    const time = details.scheduledFor;
    const then = timedSlots(stateAt(ms));
    if (details.passId) {
      // A pass moved since the device read it: the time says which of its slots.
      if (then.some((s) => s.passId === details.passId && s.time === time)) return details;
      return hadSlotNear(ms, time, details.passId, windowMinutes) ? { scheduledFor: time } : details;
    }
    const inPass = then.find((s) => s.time === time && s.passId);
    if (inPass) return { passId: inPass.passId, scheduledFor: time };
    const day = dayInZone(new Date(ms), timeZone);
    if (timedSlots(endOf(day)).some((s) => s.time === time)) return details;
    return hadSlotNear(ms, time, null, windowMinutes) ? { scheduledFor: time } : {};
  };

  const doseAt = (ms: number) => stateAt(ms).dose;

  return { takenOn, slotsOn, doseName, doseAt };
}

import type { DueMedication } from "./dueDoses";
import type { PassLike } from "./medicationPass";

import { addDays } from "../../../domain/core/entryTiming";
import { startOfDay } from "../../../domain/core/zonedDay";
import { doseSlotsBetween } from "./dueDoses";
import { duePasses } from "./duePasses";

// The medication plan ahead (the connector's `dose_schedule`): each day's
// rounds from `from` on, as Today would show them, with no state. It reads no
// doses: what was given is `dueDoses`'s. The slots come from the due-dose
// core's range expansion (`doseSlotsBetween`) and are grouped by `duePasses`,
// so a day has the same rounds Today shows. Pure; data:unit tests it.

export type ScheduledRound = {
  /** The pass, or null for a medication's own time. */
  passId: string | null;
  /** The pass's name, or null for a medication's own time. */
  name: string | null;
  /** "HH:MM" in the recipient's zone. */
  time: string;
  /** The moment it falls (ISO 8601). */
  at: string;
  /** Its medications, by name, each with what's given. */
  medications: { medication: DueMedication; amount: string | null }[];
};

export type ScheduledDay = {
  /** The recipient's day, "YYYY-MM-DD". */
  day: string;
  /** By time, a pass ahead of a time of its own at the same time. */
  rounds: ScheduledRound[];
};

export type DoseSchedule = {
  days: ScheduledDay[];
  /** Current as-needed medications, by name, with their daily maximum (null without one). */
  asNeeded: { medication: DueMedication; max: number | null }[];
};

export type DoseScheduleInput = {
  medications: readonly DueMedication[];
  /** The group's passes, deleted ones too: a pass slot falls at its pass's time. */
  passes?: readonly Pick<PassLike, "id" | "name" | "time">[];
  /** The first day, "YYYY-MM-DD" in the recipient's zone. */
  from: string;
  /** How many days, from `from`. */
  days: number;
  /** The recipient's IANA zone. */
  timeZone: string;
};

const byName = (a: DueMedication, b: DueMedication) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);

/**
 * The plan for `days` days from `from`: each day's rounds (a pass's
 * medications together, a medication's own time on its own), by time, and the
 * as-needed medications. Only current, live medications, each from the day it
 * started or was added; the schedule as it is now. Times are wall-clock in
 * `timeZone`, DST-safe.
 */
export function doseSchedule({
  medications,
  passes = [],
  from,
  days,
  timeZone,
}: DoseScheduleInput): DoseSchedule {
  const live = medications.filter((m) => m.status === "current" && !m.deletedAt);
  const dayList = Array.from({ length: Math.max(0, days) }, (_, i) => addDays(from, i));
  const end = addDays(from, dayList.length);
  // From the first day's start to the last day's end; a 00:00 slot of the day after stays out.
  const slots = dayList.length
    ? doseSlotsBetween({
        medications: live,
        passes,
        doses: [],
        from: startOfDay(from, timeZone),
        to: startOfDay(end, timeZone),
        timeZone,
      }).filter((s) => s.day >= from && s.day < end)
    : [];

  return {
    days: dayList.map((day) => ({
      day,
      rounds: duePasses({ slots: slots.filter((s) => s.day === day) }, passes).map((pass) => ({
        passId: pass.passId,
        name: pass.name,
        time: pass.time,
        at: pass.at,
        medications: pass.slots.map((s) => ({ medication: s.medication, amount: s.amount })),
      })),
    })),
    asNeeded: live
      .filter((m) => m.schedule.type === "asNeeded")
      .sort(byName)
      .map((medication) => ({
        medication,
        max: medication.schedule.type === "asNeeded" ? (medication.schedule.maxPerDay ?? null) : null,
      })),
  };
}

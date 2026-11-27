import type { DoseSlot, DueDose, DueMedication } from "./dueDoses";
import type { PassLike } from "./medicationPass";
import type { ScheduleChange } from "./scheduleHistory";

import { addDays } from "../core/entryTiming";
import { startOfDay } from "../core/zonedDay";
import { doseSlotsBetween } from "./dueDoses";
import { duePasses } from "./duePasses";

// The dose record (the connector's `past_doses`): each past day's rounds with
// every slot's state and the dose that answered it, the shape of the printed
// weekly sheet. The slots come from the due-dose core's range expansion
// (`doseSlotsBetween`, settled at `now`) and are grouped by `duePasses`, so a
// day has the rounds Today showed. Pure; data:unit tests it.

export type RecordedRound = {
  /** The pass, or null for a medication's own time. */
  passId: string | null;
  /** The pass's name, or null for a medication's own time. */
  name: string | null;
  /** "HH:MM" in the recipient's zone. */
  time: string;
  /** Its slots, by medication name, each with its state and answering dose. */
  slots: DoseSlot[];
};

export type RecordedDay = {
  /** The recipient's day, "YYYY-MM-DD". */
  day: string;
  /** As `duePasses` orders them: by time, a pass ahead of a time of its own at the same time. */
  rounds: RecordedRound[];
};

export type DoseRecord = { days: RecordedDay[] };

export type DoseRecordInput = {
  /** Current and stopped medications (not deleted): a stopped one counts up to its stop day. */
  medications: readonly DueMedication[];
  /** The group's passes, deleted ones too. */
  passes?: readonly Pick<PassLike, "id" | "name" | "time">[];
  /** Live doses from the day before `from` through `now`, any order. */
  doses: readonly DueDose[];
  /** The group's `medicationChange` entries from two days before `from` on, deleted ones too. */
  changes?: readonly ScheduleChange[];
  /** The first day, "YYYY-MM-DD" in the recipient's zone. */
  from: string;
  /** How many days, from `from`; none after `now`'s day. */
  days: number;
  /** What the states are settled at: today's later slots are upcoming. */
  now: Date;
  /** The recipient's IANA zone. */
  timeZone: string;
};

/**
 * Each day's rounds from `from` for `days` days, with each slot's state at
 * `now`: answered ones given, skipped or refused; earlier days' open ones
 * missed; today's due, overdue or upcoming. Each day has the schedule it had
 * then (`changes`). Times are wall-clock in `timeZone`, DST-safe.
 */
export function doseRecord({
  medications,
  passes = [],
  doses,
  changes = [],
  from,
  days,
  now,
  timeZone,
}: DoseRecordInput): DoseRecord {
  const dayList = Array.from({ length: Math.max(0, days) }, (_, i) => addDays(from, i));
  const end = addDays(from, dayList.length);
  // From the first day's start to the last day's end; a 00:00 slot of the day after stays out.
  const slots = dayList.length
    ? doseSlotsBetween({
        medications,
        passes,
        doses,
        changes,
        from: startOfDay(from, timeZone),
        to: startOfDay(end, timeZone),
        now,
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
        slots: pass.slots,
      })),
    })),
  };
}

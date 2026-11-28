import type { DoseSlot, DueDose, DueMedication } from "./dueDoses";
import type { PassLike } from "./medicationPass";
import type { ScheduleChange } from "./scheduleHistory";

import { z } from "zod";
import { addDays } from "../../../domain/core/entryTiming";
import { startOfDay } from "../../../domain/core/zonedDay";
import { doseSlotsBetween } from "./dueDoses";
import { duePasses } from "./duePasses";
import { DOSE_STATUSES, MEDICATION_LIMITS, scheduleTimeZSchema } from "./medication";

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

// ---------------------------------------------------------------------------
// A dose sheet's marks (the connector's `log_past_doses`): a photographed
// week of the paper sheet, each box marked given, skipped or refused, read
// against the record. Pure; the server writes the `add`s.
// ---------------------------------------------------------------------------

/** At most this many marks a call (a week of a full sheet fits). */
export const SHEET_DOSE_MARKS_MAX = 200;

/** One marked box: a scheduled slot named as `past_doses` lists it, and the answer on the sheet. */
export const sheetDoseMarkZSchema = z.object({
  medicationId: z.uuid(),
  /** The recipient's day, "YYYY-MM-DD". */
  day: z.iso.date(),
  /** The slot's time, "HH:MM" in the recipient's zone. */
  time: scheduleTimeZSchema,
  status: z.enum(DOSE_STATUSES),
  note: z.string().trim().max(MEDICATION_LIMITS.doseNote).optional(),
});
export type SheetDoseMark = z.infer<typeof sheetDoseMarkZSchema>;

/**
 * What a mark comes to: `add` (the slot is open: missed, or due or overdue
 * today), `alreadyLogged` (its dose has the mark's status), `conflict` (its
 * dose has another; never changed), `noSlot` (no slot for that medication,
 * day and time), `notYet` (the slot is after `now`), `tooOld` (its day is
 * before `earliestDay`), `repeated` (an earlier mark named the slot).
 */
export type SheetDoseOutcome =
  | { outcome: "add"; slot: DoseSlot }
  | { outcome: "alreadyLogged" | "conflict"; slot: DoseSlot; dose: DueDose }
  | { outcome: "notYet" | "repeated"; slot: DoseSlot }
  | { outcome: "noSlot" | "tooOld" };

/** A slot's name on a sheet: medication, day and time. */
const markKey = (medicationId: string, day: string, time: string) =>
  `${medicationId.toLowerCase()}|${day}|${time}`;

/**
 * Each mark's outcome, in the marks' order, against `record` (built with the
 * doses and settled at `now`, covering the marks' days from `earliestDay`).
 * The day's reach is decided first, then the slot (from the record only: no
 * slot rule of its own), then an earlier mark for it, then its dose.
 */
export function sheetDoseOutcomes({
  record,
  marks,
  now,
  earliestDay,
}: {
  record: DoseRecord;
  marks: readonly Pick<SheetDoseMark, "medicationId" | "day" | "time" | "status">[];
  now: Date;
  /** The first day a mark may name, "YYYY-MM-DD". */
  earliestDay: string;
}): SheetDoseOutcome[] {
  const slots = new Map<string, DoseSlot>();
  for (const day of record.days)
    for (const round of day.rounds)
      for (const slot of round.slots) slots.set(markKey(slot.medication.id, slot.day, slot.time), slot);
  const named = new Set<string>();
  return marks.map((mark): SheetDoseOutcome => {
    if (mark.day < earliestDay) return { outcome: "tooOld" };
    const key = markKey(mark.medicationId, mark.day, mark.time);
    const slot = slots.get(key);
    if (!slot) return { outcome: "noSlot" };
    if (named.has(key)) return { outcome: "repeated", slot };
    named.add(key);
    if (slot.dose)
      return {
        outcome: slot.dose.details.status === mark.status ? "alreadyLogged" : "conflict",
        slot,
        dose: slot.dose,
      };
    if (new Date(slot.at).getTime() > now.getTime()) return { outcome: "notYet", slot };
    return { outcome: "add", slot };
  });
}

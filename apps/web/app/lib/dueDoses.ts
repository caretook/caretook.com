import type { DoseDetails, MedicationSchedule, MedicationStatus, PassLike } from "@caretook/data/schema";

import { slotAmount, slotTimes } from "@caretook/data/schema";
import { addDays, dayInZone, zonedInstant } from "./zonedDay";

// What's due today: a plain function of `now`, so a timer re-evaluates it
// (`useDueDoses`) and tests pin every boundary. Schedule times are the
// recipient's (`timeZone`), whatever zone the device is in. Missed doses are
// worked out here, never written. Pure; web:unit tests it.

/** What `dueDoses` needs of a medication (a `LocalMedication` fits). */
export type DueMedication = {
  id: string;
  name: string;
  strength: string | null;
  dose: string | null;
  schedule: MedicationSchedule;
  status: MedicationStatus;
  deletedAt: string | null;
  /** ISO 8601: no slots on days before the one it was added. */
  createdAt?: string | null;
  /** "YYYY-MM-DD": no slots on days before it started. */
  startedOn?: string | null;
};

/** What `dueDoses` needs of a dose entry (a `DoseEntry` fits). */
export type DueDose = {
  id: string;
  /** ISO 8601. */
  occurredAt: string;
  details: Pick<DoseDetails, "medicationId" | "status" | "scheduledFor"> & {
    passId?: DoseDetails["passId"];
  };
};

export type SlotState = "upcoming" | "due" | "overdue" | "given" | "skipped" | "refused" | "missed";

/** One scheduled time of one medication on one day. */
export type DoseSlot = {
  medication: DueMedication;
  /** The recipient's day, "YYYY-MM-DD". */
  day: string;
  /** The schedule time, "HH:MM" in the recipient's zone: its pass's time, or its own. */
  time: string;
  /** The pass the slot is in, or null for a time of its own. */
  passId: string | null;
  /** What's given: the slot's amount, else the medication's dose (`slotAmount`). */
  amount: string | null;
  /** The moment it falls (ISO 8601). */
  at: string;
  state: SlotState;
  /** The dose that answers it, when one does. */
  dose: DueDose | null;
};

export type AsNeededToday = {
  medication: DueMedication;
  /** Doses given today (skipped and refused ones don't count). */
  count: number;
  max: number | null;
  /** How many more today, or null without a maximum. */
  left: number | null;
};

export type DueDoses = {
  /** Today, in the recipient's zone. */
  day: string;
  /** Today's slots, by time, then medication name. */
  slots: DoseSlot[];
  /** Yesterday's slots (answered or missed), by time. */
  yesterday: DoseSlot[];
  /** Yesterday's slots nothing answered. */
  missed: DoseSlot[];
  /** Current as-needed medications, by name, with today's count. */
  asNeeded: AsNeededToday[];
  windowMinutes: number;
  /** The recipient's zone the day and times are in. */
  timeZone: string;
};

export type DueDosesInput = {
  medications: readonly DueMedication[];
  /** The group's passes, deleted ones too: a pass slot falls at its pass's time. */
  passes?: readonly Pick<PassLike, "id" | "time">[];
  /** Live doses (not deleted) from yesterday's start on, any order. */
  doses: readonly DueDose[];
  now: Date;
  /** The recipient's IANA zone. */
  timeZone: string;
  /** A slot is overdue this long after its time (default 60). */
  overdueAfterMinutes?: number;
  /** A dose without `scheduledFor` answers the nearest unanswered slot this close (default 120). */
  windowMinutes?: number;
};

const MINUTE = 60_000;

const isActive = (m: DueMedication) => m.status === "current" && !m.deletedAt;

const byName = (a: DueMedication, b: DueMedication) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);

/** Whether a medication has slots on `day`: not before it started, nor before the day it was added. */
const scheduledOn = (m: DueMedication, day: string, timeZone: string) => {
  if (m.startedOn && day < m.startedOn) return false;
  if (m.createdAt) {
    const added = new Date(m.createdAt);
    if (!Number.isNaN(added.getTime()) && day < dayInZone(added, timeZone)) return false;
  }
  return true;
};

type Working = { slot: Omit<DoseSlot, "state" | "dose">; ms: number; dose: DueDose | null };

/**
 * Today's slots and yesterday's, each with its state; the as-needed counts.
 *
 * A slot in a pass falls at the pass's time (so moving a pass moves its
 * slots); a slot of its own at its time. A medication with a pass and a time
 * of its own at the same moment has one slot there (the pass's).
 *
 * A dose answers a slot of its medication: the one in its pass (`passId`)
 * when the medication still has that pass, so a retimed pass keeps its
 * answered doses; else the one its `scheduledFor` names (the nearest such,
 * yesterday's or today's; when both are answered, none); else the nearest
 * slot nothing has answered within `windowMinutes`. Unanswered, a slot is
 * `upcoming` before its time, `due` from it, `overdue` `overdueAfterMinutes`
 * after it, and `missed` once its day has ended. Only current, not deleted,
 * scheduled medications have slots.
 */
export function dueDoses({
  medications,
  passes = [],
  doses,
  now,
  timeZone,
  overdueAfterMinutes = 60,
  windowMinutes = 120,
}: DueDosesInput): DueDoses {
  const day = dayInZone(now, timeZone);
  const yesterdayDay = addDays(day, -1);
  const active = medications.filter(isActive).sort(byName);

  const working: Working[] = [];
  for (const medication of active) {
    // One slot per time: a pass's (the first) ahead of a time of its own.
    const all = slotTimes(medication.schedule, passes);
    const timed = all.filter((slot) => {
      const first =
        all.find((s) => s.time === slot.time && s.passId) ?? all.find((s) => s.time === slot.time);
      return first === slot;
    });
    for (const d of [yesterdayDay, day]) {
      if (!scheduledOn(medication, d, timeZone)) continue;
      for (const { time, passId, amount } of timed) {
        const at = zonedInstant(d, time, timeZone);
        working.push({
          slot: {
            medication,
            day: d,
            time,
            passId,
            amount: slotAmount(medication, { amount }),
            at: at.toISOString(),
          },
          ms: at.getTime(),
          dose: null,
        });
      }
    }
  }

  // Doses that name a pass or a slot first, then the rest; each in time order.
  const names = (d: DueDose) => !!d.details.passId || !!d.details.scheduledFor;
  const ordered = [...doses].sort((a, b) => {
    const named = Number(!names(a)) - Number(!names(b));
    return named || a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);
  });
  const nearest = (candidates: Working[], ms: number) =>
    candidates.reduce<Working | null>(
      (best, w) => (!best || Math.abs(w.ms - ms) < Math.abs(best.ms - ms) ? w : best),
      null,
    );
  for (const dose of ordered) {
    const ms = new Date(dose.occurredAt).getTime();
    if (Number.isNaN(ms)) continue;
    const { medicationId, passId, scheduledFor } = dose.details;
    const own = working.filter((w) => w.slot.medication.id === medicationId);
    const open = own.filter((w) => !w.dose);
    // A dose in one of its medication's passes answers only that pass's slot;
    // one naming one of its times answers only that time (none left: no
    // slot). Naming a pass or time the schedule no longer has, it's matched
    // like an unnamed one.
    const match = (() => {
      if (passId && own.some((w) => w.slot.passId === passId))
        return nearest(
          open.filter((w) => w.slot.passId === passId),
          ms,
        );
      if (scheduledFor && own.some((w) => w.slot.time === scheduledFor))
        return nearest(
          open.filter((w) => w.slot.time === scheduledFor),
          ms,
        );
      return nearest(
        open.filter((w) => Math.abs(w.ms - ms) <= windowMinutes * MINUTE),
        ms,
      );
    })();
    if (match) match.dose = dose;
  }

  const nowMs = now.getTime();
  const stateOf = (w: Working): SlotState => {
    if (w.dose) return w.dose.details.status;
    if (w.slot.day < day) return "missed";
    if (nowMs < w.ms) return "upcoming";
    return nowMs - w.ms >= overdueAfterMinutes * MINUTE ? "overdue" : "due";
  };
  const slots = working
    .map((w): DoseSlot => ({ ...w.slot, state: stateOf(w), dose: w.dose }))
    .sort((a, b) => a.at.localeCompare(b.at) || byName(a.medication, b.medication));

  const asNeeded = active
    .filter((m) => m.schedule.type === "asNeeded")
    .map((medication): AsNeededToday => {
      const count = doses.filter(
        (d) =>
          d.details.medicationId === medication.id &&
          d.details.status === "given" &&
          dayInZone(new Date(d.occurredAt), timeZone) === day,
      ).length;
      const max = medication.schedule.type === "asNeeded" ? (medication.schedule.maxPerDay ?? null) : null;
      return { medication, count, max, left: max === null ? null : Math.max(0, max - count) };
    });

  const yesterday = slots.filter((s) => s.day === yesterdayDay);
  return {
    day,
    slots: slots.filter((s) => s.day === day),
    yesterday,
    missed: yesterday.filter((s) => s.state === "missed"),
    asNeeded,
    windowMinutes,
    timeZone,
  };
}

/** Whether a slot still wants a dose now. */
export const isDueNow = (slot: DoseSlot) => slot.state === "due" || slot.state === "overdue";

/** Whether a slot hasn't been answered yet (and still can be: it's today's). */
export const isOpen = (slot: DoseSlot) =>
  slot.state === "upcoming" || slot.state === "due" || slot.state === "overdue";

/** Today's slots that are due or overdue, for the Due now strip. */
export const dueNow = (due: DueDoses) => due.slots.filter(isDueNow);

export type DoseWarning =
  { type: "alreadyGiven"; time: string; givenAt: string } | { type: "overMax"; count: number; max: number };

/** A dose about to be logged. */
export type PlannedDose = {
  medicationId: string;
  status: DoseDetails["status"];
  /** The pass it's logged in, which names its slot ahead of `scheduledFor`. */
  passId?: string | null;
  scheduledFor?: string | null;
  /** ISO 8601; now when left out. */
  occurredAt?: string | null;
};

/**
 * Why logging this dose might be a mistake, before it's saved: a slot it
 * answers was already given (a double dose), or an as-needed medication is
 * at its maximum for today. Only a dose that's given can be either.
 */
export function doseWarnings(due: DueDoses, planned: PlannedDose, now: Date): DoseWarning[] {
  if (planned.status !== "given") return [];
  const at = planned.occurredAt ? new Date(planned.occurredAt) : now;
  const ms = Number.isNaN(at.getTime()) ? now.getTime() : at.getTime();
  const warnings: DoseWarning[] = [];

  const own = [...due.yesterday, ...due.slots].filter((s) => s.medication.id === planned.medicationId);
  const distance = (s: DoseSlot) => Math.abs(new Date(s.at).getTime() - ms);
  const closest = (list: DoseSlot[]) =>
    list.reduce<DoseSlot | null>((best, s) => (!best || distance(s) < distance(best) ? s : best), null);
  let given: DoseSlot | null = null;
  const inPass = planned.passId ? own.filter((s) => s.passId === planned.passId) : [];
  if (inPass.length) {
    const slot = closest(inPass);
    if (slot?.state === "given") given = slot;
  } else if (planned.scheduledFor) {
    const slot = closest(own.filter((s) => s.time === planned.scheduledFor));
    if (slot?.state === "given") given = slot;
  } else {
    const near = own.filter((s) => distance(s) <= due.windowMinutes * MINUTE);
    if (!near.some((s) => !s.dose)) given = closest(near.filter((s) => s.state === "given"));
  }
  if (given?.dose) warnings.push({ type: "alreadyGiven", time: given.time, givenAt: given.dose.occurredAt });

  // Only a dose on the recipient's today counts toward today's maximum.
  const asNeeded = due.asNeeded.find((a) => a.medication.id === planned.medicationId);
  if (
    asNeeded?.max != null &&
    asNeeded.count >= asNeeded.max &&
    dayInZone(new Date(ms), due.timeZone) === due.day
  )
    warnings.push({ type: "overMax", count: asNeeded.count, max: asNeeded.max });
  return warnings;
}

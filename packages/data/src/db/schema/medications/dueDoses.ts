import type { DoseDetails, MedicationSchedule, MedicationStatus } from "./medication";
import type { PassLike, TimedSlot } from "./medicationPass";
import type { DoseSlotName, ScheduleChange } from "./scheduleHistory";

import { addDays } from "../core/entryTiming";
import { dayInZone, zonedInstant } from "../core/zonedDay";
import { slotAmount } from "./medication";
import { scheduleHistory } from "./scheduleHistory";

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
  /** "YYYY-MM-DD": while completed or discontinued, no slots from this day on (`doseSlotsBetween`). */
  stoppedOn?: string | null;
};

/** What `dueDoses` needs of a dose entry (a `DoseEntry` fits). */
export type DueDose = {
  id: string;
  /** ISO 8601. */
  occurredAt: string;
  details: Pick<DoseDetails, "medicationId" | "status" | "scheduledFor"> & {
    passId?: DoseDetails["passId"];
    /** The round it was logged in (`duePasses`, Given all). */
    passLogId?: DoseDetails["passLogId"];
  };
  /** Who logged it (the user id), when known. */
  createdBy?: string | null;
};

/** How long after its time an unanswered slot turns overdue, in minutes (it is due from its time). */
export const OVERDUE_AFTER_MINUTES = 60;

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
  /**
   * Extra doses: given ones that would have answered it but found it already
   * given (each answers nothing, `doseWarnings`'s `alreadyGiven`), in time
   * order. Empty unless `dose` was given too.
   */
  extra: DueDose[];
};

export type AsNeededToday = {
  medication: DueMedication;
  /** Doses given today (skipped and refused ones don't count). */
  count: number;
  max: number | null;
  /** How many more today, or null without a maximum. */
  left: number | null;
  /** Today's given doses past the maximum (the extra ones), in time order; none without a maximum. */
  extra: DueDose[];
  /** When today's given doses were given (ISO 8601), in time order. */
  givenAt: string[];
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
  /** The slots matching ran over: the days either side too, so `doseWarnings` reads the same ones. */
  matched: DoseSlot[];
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
  /** A slot is overdue this long after its time (default `OVERDUE_AFTER_MINUTES`). */
  overdueAfterMinutes?: number;
  /** How far a dose reaches for its slot: the nearest open one this close (default 120). */
  windowMinutes?: number;
  /**
   * The group's `medicationChange` entries from the first day read on (for
   * `dueDoses`, two days before today), deleted ones too: each day reads the
   * schedule it had (`scheduleHistory`). Left out: the schedule as it is now.
   */
  changes?: readonly ScheduleChange[];
};

const MINUTE = 60_000;

const byTime = (a: DueDose, b: DueDose) =>
  a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);

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

type Working = {
  slot: Omit<DoseSlot, "state" | "dose" | "extra">;
  ms: number;
  dose: DueDose | null;
  extra?: DueDose[];
};

/** One slot per time: a pass's, the first, ahead of a time of its own. */
const onePerTime = (all: readonly TimedSlot[]) =>
  all.filter((slot) => {
    const first = all.find((s) => s.time === slot.time && s.passId) ?? all.find((s) => s.time === slot.time);
    return first === slot;
  });

/** Every medication's slots on `days`, as `slotsOn` gives them. */
const expandSlots = (
  medications: readonly DueMedication[],
  days: readonly string[],
  timeZone: string,
  slotsOn: (m: DueMedication, day: string) => readonly TimedSlot[],
): Working[] => {
  const working: Working[] = [];
  for (const medication of medications) {
    for (const d of days) {
      if (!scheduledOn(medication, d, timeZone)) continue;
      for (const { time, passId, amount } of onePerTime(slotsOn(medication, d))) {
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
  return working;
};

const nearest = (candidates: readonly Working[], ms: number) =>
  candidates.reduce<Working | null>(
    (best, w) => (!best || Math.abs(w.ms - ms) < Math.abs(best.ms - ms) ? w : best),
    null,
  );

const inWindow = (candidates: readonly Working[], ms: number, windowMinutes: number) =>
  candidates.filter((w) => Math.abs(w.ms - ms) <= windowMinutes * MINUTE);

/** The medication's slots a dose names: its pass's, else its time's; null when it names neither any more. */
const namedSlots = (own: readonly Working[], { passId, scheduledFor }: DoseSlotName) => {
  const inPass = passId ? own.filter((w) => w.slot.passId === passId) : [];
  if (inPass.length) return inPass;
  const atTime = scheduledFor ? own.filter((w) => w.slot.time === scheduledFor) : [];
  return atTime.length ? atTime : null;
};

/** Of one name's slots, the one at `ms`: the nearest within the window, else the one on its day. */
const slotAt = (named: readonly Working[], ms: number, windowMinutes: number, timeZone: string) => {
  const day = dayInZone(new Date(ms), timeZone);
  return nearest(inWindow(named, ms, windowMinutes), ms) ?? named.find((w) => w.slot.day === day) ?? null;
};

/**
 * The given slot a surplus dose would have answered (an extra dose), or null:
 * the slot its name points to, else the nearest given one in the window, as
 * `doseWarnings` finds it.
 */
const slotGivenTwice = (
  own: readonly Working[],
  name: DoseSlotName,
  ms: number,
  windowMinutes: number,
  timeZone: string,
) => {
  const named = namedSlots(own, name);
  const slot = named
    ? slotAt(named, ms, windowMinutes, timeZone)
    : nearest(
        inWindow(own, ms, windowMinutes).filter((w) => w.dose?.details.status === "given"),
        ms,
      );
  return slot?.dose?.details.status === "given" ? slot : null;
};

/** The open slot a dose would answer, or null (a surplus dose). */
const slotToAnswer = (
  own: readonly Working[],
  name: DoseSlotName,
  ms: number,
  windowMinutes: number,
  timeZone: string,
) => {
  const named = namedSlots(own, name);
  if (!named)
    return nearest(
      inWindow(
        own.filter((w) => !w.dose),
        ms,
        windowMinutes,
      ),
      ms,
    );
  // The slot it's for, answered or not: one already answered makes this dose surplus.
  const slot = slotAt(named, ms, windowMinutes, timeZone);
  return slot && !slot.dose ? slot : null;
};

/** Each medication's schedule history, and what a dose names when read through it. */
const historiesOf = (
  medications: readonly DueMedication[],
  { passes, changes, timeZone, windowMinutes }: HistoryInput,
) => {
  const histories = new Map(
    medications.map((medication) => [
      medication.id,
      scheduleHistory({ medication, passes, changes, timeZone }),
    ]),
  );
  return {
    slotsOn: (m: DueMedication, day: string) => histories.get(m.id)?.slotsOn(day) ?? [],
    nameOf: (dose: DueDose) =>
      histories.get(dose.details.medicationId)?.doseName(dose, windowMinutes) ?? dose.details,
  };
};

type HistoryInput = {
  passes: readonly Pick<PassLike, "id" | "time">[];
  changes: readonly ScheduleChange[];
  timeZone: string;
  windowMinutes: number;
};

/** Each dose answers at most one slot (the rules are `dueDoses`'s). */
const answerSlots = (
  working: Working[],
  doses: readonly DueDose[],
  windowMinutes: number,
  timeZone: string,
  nameOf: (dose: DueDose) => DoseSlotName = (dose) => dose.details,
) => {
  // Doses that name a pass or a slot first, then the rest; each in time order,
  // so the earliest keeps the slot.
  const slotNames = new Map(doses.map((d) => [d, nameOf(d)]));
  const nameFor = (d: DueDose) => slotNames.get(d) ?? d.details;
  const names = (d: DueDose) => !!nameFor(d).passId || !!nameFor(d).scheduledFor;
  const ordered = [...doses].sort((a, b) => {
    const named = Number(!names(a)) - Number(!names(b));
    return named || a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);
  });
  for (const dose of ordered) {
    const ms = new Date(dose.occurredAt).getTime();
    if (Number.isNaN(ms)) continue;
    const own = working.filter((w) => w.slot.medication.id === dose.details.medicationId);
    const match = slotToAnswer(own, nameFor(dose), ms, windowMinutes, timeZone);
    if (match) {
      match.dose = dose;
      continue;
    }
    if (dose.details.status !== "given") continue;
    const twice = slotGivenTwice(own, nameFor(dose), ms, windowMinutes, timeZone);
    if (twice) twice.extra = [...(twice.extra ?? []), dose];
  }
};

/** The slots with their states at `now` (`today` is its day): answered, missed once their day ended, else by the clock. */
const settle = (
  working: readonly Working[],
  { now, today, overdueAfterMinutes }: { now: Date; today: string; overdueAfterMinutes: number },
): DoseSlot[] => {
  const nowMs = now.getTime();
  const stateOf = (w: Working): SlotState => {
    if (w.dose) return w.dose.details.status;
    if (w.slot.day < today) return "missed";
    if (nowMs < w.ms) return "upcoming";
    return nowMs - w.ms >= overdueAfterMinutes * MINUTE ? "overdue" : "due";
  };
  return working
    .map((w): DoseSlot => ({
      ...w.slot,
      state: stateOf(w),
      dose: w.dose,
      extra: [...(w.extra ?? [])].sort(byTime),
    }))
    .sort((a, b) => a.at.localeCompare(b.at) || byName(a.medication, b.medication));
};

/**
 * Today's slots and yesterday's, each with its state; the as-needed counts.
 *
 * A slot in a pass falls at the pass's time (so moving a pass moves its
 * slots); a slot of its own at its time. A medication with a pass and a time
 * of its own at the same moment has one slot there (the pass's).
 *
 * A dose naming a pass (`passId`) or time (`scheduledFor`) its medication
 * still has answers only a slot of that name. The nearest one within
 * `windowMinutes`, answered or not, is its slot: open, the dose answers it
 * (so 23:30's dose given at 00:10 answers last night); already answered, the
 * dose answers nothing. With none in the window, it answers the open one on
 * the recipient's day it was given, else nothing. So a second dose stays on
 * the timeline and never marks another day's slot. A retimed pass keeps its
 * answered doses. Any other dose answers the nearest open slot within the
 * window. Named doses go first,
 * each kind in time order, so the earliest keeps the slot. Slots on the days
 * either side take part in the matching but aren't returned, so a dose
 * answering one of them can't land on a day shown. Unanswered, a slot is
 * `upcoming` before its time, `due` from it, `overdue` `overdueAfterMinutes`
 * after it, and `missed` once its day has ended. Only current, not deleted,
 * scheduled medications have slots. With `changes`, each day has the slots of
 * its own schedule (`scheduleHistory`), so a slot whose time passed before the
 * medication or the slot was added isn't there.
 */
export function dueDoses({
  medications,
  passes = [],
  doses,
  now,
  timeZone,
  overdueAfterMinutes = OVERDUE_AFTER_MINUTES,
  windowMinutes = 120,
  changes = [],
}: DueDosesInput): DueDoses {
  const day = dayInZone(now, timeZone);
  const yesterdayDay = addDays(day, -1);
  const active = medications.filter(isActive).sort(byName);
  const reach = [addDays(day, -2), yesterdayDay, day, addDays(day, 1)];
  const history = historiesOf(active, { passes, changes, timeZone, windowMinutes });
  const working = expandSlots(active, reach, timeZone, history.slotsOn);
  // Over all four days, before `settle`: a dose near midnight keeps its own slot.
  answerSlots(working, doses, windowMinutes, timeZone, history.nameOf);
  const slots = settle(working, { now, today: day, overdueAfterMinutes });

  const asNeeded = active
    .filter((m) => m.schedule.type === "asNeeded")
    .map((medication): AsNeededToday => {
      const given = doses
        .filter(
          (d) =>
            d.details.medicationId === medication.id &&
            d.details.status === "given" &&
            dayInZone(new Date(d.occurredAt), timeZone) === day,
        )
        .sort(byTime);
      const count = given.length;
      const max = medication.schedule.type === "asNeeded" ? (medication.schedule.maxPerDay ?? null) : null;
      return {
        medication,
        count,
        max,
        left: max === null ? null : Math.max(0, max - count),
        extra: max === null ? [] : given.slice(max),
        givenAt: given.map((d) => d.occurredAt),
      };
    });

  const yesterday = slots.filter((s) => s.day === yesterdayDay);
  return {
    day,
    slots: slots.filter((s) => s.day === day),
    yesterday,
    missed: yesterday.filter((s) => s.state === "missed"),
    matched: slots,
    asNeeded,
    windowMinutes,
    timeZone,
  };
}

export type DoseSlotsBetweenInput = Omit<DueDosesInput, "now" | "changes"> & {
  /** ISO 8601 or a Date: the range's start; slots from its day on. */
  from: string | Date;
  /** ISO 8601 or a Date: the range's end (usually now); slots up to it. */
  to: string | Date;
  /**
   * The group's `medicationChange` entries from the day before `from` on,
   * deleted ones too: each day reads the schedule it had (`scheduleHistory`).
   * Left out: every day reads the schedule as it is now.
   */
  changes?: readonly ScheduleChange[];
  /**
   * ISO 8601 or a Date: when to settle the states (today is its day). Slots
   * are still kept up to `to`, so a range ending after it shows its later
   * slots as upcoming. Left out: settled at `to`.
   */
  now?: string | Date;
};

/**
 * The range version of `dueDoses` (visit prep's missed doses): every slot
 * between `from` and `to`, answered by `doses` under the same rules (the days
 * either side take part, so a dose answering a slot just outside the range
 * stays there), with the state each has at `to`: a slot nothing answered is
 * `missed` once its day has ended. Slots fall in the
 * recipient's zone, DST-safe. Each day has the slots of its own schedule
 * (`scheduleHistory`, from `changes`), so a schedule edit, a moved pass or a
 * pause doesn't rewrite earlier days; with no entries, the schedule as it is
 * now. Medications that are completed or discontinued count up to the day
 * they stopped; deleted ones not at all. `doses` should cover the range (a
 * little either side is fine).
 */
export function doseSlotsBetween({
  medications,
  passes = [],
  doses,
  from,
  to,
  changes = [],
  now,
  timeZone,
  overdueAfterMinutes = OVERDUE_AFTER_MINUTES,
  windowMinutes = 120,
}: DoseSlotsBetweenInput): DoseSlot[] {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const lastDay = dayInZone(end, timeZone);
  const days: string[] = [];
  const pastEnd = addDays(lastDay, 1);
  for (let d = addDays(dayInZone(start, timeZone), -1); d <= pastEnd; d = addDays(d, 1)) days.push(d);
  const taken = medications
    .filter((m) => !m.deletedAt && (m.status === "current" || !!m.stoppedOn))
    .sort(byName);
  const history = historiesOf(taken, { passes, changes, timeZone, windowMinutes });
  const working = expandSlots(taken, days, timeZone, history.slotsOn);
  // Answered before trimming to the range, so a dose near its edge keeps its own slot.
  answerSlots(working, doses, windowMinutes, timeZone, history.nameOf);
  const inRange = working.filter((w) => w.ms >= start.getTime() && w.ms <= end.getTime());
  const at = now === undefined ? end : new Date(now);
  if (Number.isNaN(at.getTime())) return [];
  return settle(inRange, { now: at, today: dayInZone(at, timeZone), overdueAfterMinutes });
}

/** Per medication, the slots in `slots` that were missed, skipped or refused, most first; none when all were given. */
export function missedDoseCounts(slots: readonly DoseSlot[]) {
  const byMedication = new Map<
    string,
    { medication: DueMedication; missed: number; skipped: number; refused: number; slots: number }
  >();
  for (const slot of slots) {
    if (slot.state === "upcoming" || slot.state === "due" || slot.state === "overdue") continue;
    const row = byMedication.get(slot.medication.id) ?? {
      medication: slot.medication,
      missed: 0,
      skipped: 0,
      refused: 0,
      slots: 0,
    };
    row.slots += 1;
    if (slot.state === "missed") row.missed += 1;
    if (slot.state === "skipped") row.skipped += 1;
    if (slot.state === "refused") row.refused += 1;
    byMedication.set(slot.medication.id, row);
  }
  return [...byMedication.values()]
    .filter((r) => r.missed + r.skipped + r.refused > 0)
    .sort(
      (a, b) =>
        b.missed + b.skipped + b.refused - (a.missed + a.skipped + a.refused) ||
        byName(a.medication, b.medication),
    );
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
 * Why logging this dose might be a mistake, before it's saved: it would
 * answer nothing because its slot was already given (a double dose; the same
 * lookup as the matching), or an as-needed medication is at its maximum for
 * today. Only a dose that's given can be either.
 */
export function doseWarnings(due: DueDoses, planned: PlannedDose, now: Date): DoseWarning[] {
  if (planned.status !== "given") return [];
  const at = planned.occurredAt ? new Date(planned.occurredAt) : now;
  const ms = Number.isNaN(at.getTime()) ? now.getTime() : at.getTime();
  const warnings: DoseWarning[] = [];

  const own = due.matched
    .filter((s) => s.medication.id === planned.medicationId)
    .map((slot): Working => ({ slot, ms: new Date(slot.at).getTime(), dose: slot.dose }));
  const isGiven = (w: Working | null) => w?.dose?.details.status === "given";
  const named = namedSlots(own, planned);
  let given: Working | null = null;
  if (named) {
    if (!slotToAnswer(own, planned, ms, due.windowMinutes, due.timeZone)) {
      const slot = slotAt(named, ms, due.windowMinutes, due.timeZone);
      if (isGiven(slot)) given = slot;
    }
  } else {
    const near = inWindow(own, ms, due.windowMinutes);
    if (!near.some((w) => !w.dose)) given = nearest(near.filter(isGiven), ms);
  }
  if (given?.dose)
    warnings.push({ type: "alreadyGiven", time: given.slot.time, givenAt: given.dose.occurredAt });

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

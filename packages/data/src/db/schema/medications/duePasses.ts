import type { DoseSlot, DueDoses } from "./dueDoses";
import type { DoseDetails } from "./medication";
import type { PassLike } from "./medicationPass";

import { addDays } from "../../../domain/core/entryTiming";
import { uuidV5 } from "../../../domain/core/uuidV5";
import { dayInZone, zonedInstant } from "../../../domain/core/zonedDay";
import { isOpen } from "./dueDoses";

// Today's slots rolled up into passes (medication rounds): what Today, the
// Dose sheet, Upcoming and the timeline's medication strip show, and what
// Given all writes. A slot in a pass belongs to that pass; a slot at a time of
// its own is a pass of one (one medication at one time). Pure; web:unit
// tests it.

/**
 * A pass's state: `done` once every slot in it is answered (given, skipped or
 * refused); otherwise its open slots' timing (they share one moment), as a
 * slot's: `upcoming`, `due`, `overdue`. `partly` says some of it is answered.
 */
export type PassState = "upcoming" | "due" | "overdue" | "done";

export type DuePass = {
  /** `pass:<passId>`, or `<medicationId>@HH:MM` for a pass of one: unique for the day. */
  key: string;
  /** The pass, or null for a time of its own. */
  passId: string | null;
  /** The pass's name, or null for a time of its own. */
  name: string | null;
  /** "HH:MM" in the recipient's zone. */
  time: string;
  /** The moment it falls (ISO 8601). */
  at: string;
  /** Every slot in it, by medication name. */
  slots: DoseSlot[];
  /** Its slots still wanting a dose. */
  open: DoseSlot[];
  state: PassState;
  /** Some slots answered, some still open. */
  partly: boolean;
  /** Who logged its answered slots, in the order they first logged, with how many each. */
  loggedBy: { userId: string; count: number }[];
  /** The round its answered doses were logged in, when they were (the first such): a later mark joins it. */
  passLogId: string | null;
};

/** Today's passes: named passes in the day's order by time, then name; a time of its own after a pass at the same time. */
export function duePasses(
  due: Pick<DueDoses, "slots">,
  passes: readonly Pick<PassLike, "id" | "name">[],
): DuePass[] {
  const byId = new Map(passes.map((p) => [p.id, p]));
  const groups = new Map<string, DoseSlot[]>();
  for (const slot of due.slots) {
    const key = slot.passId ? `pass:${slot.passId}` : `${slot.medication.id}@${slot.time}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const out = [...groups.entries()].map(([key, slots]): DuePass => {
    const first = slots[0]!;
    const open = slots.filter(isOpen);
    const answered = slots.filter((s) => s.dose);
    const loggedBy: DuePass["loggedBy"] = [];
    for (const slot of [...answered].sort((a, b) => a.dose!.occurredAt.localeCompare(b.dose!.occurredAt))) {
      const userId = slot.dose!.createdBy;
      if (!userId) continue;
      const seen = loggedBy.find((l) => l.userId === userId);
      if (seen) seen.count += 1;
      else loggedBy.push({ userId, count: 1 });
    }
    const timing = open[0]?.state;
    return {
      key,
      passId: first.passId,
      name: first.passId ? (byId.get(first.passId)?.name ?? null) : null,
      time: first.time,
      at: first.at,
      slots,
      open,
      state: timing === "upcoming" || timing === "due" || timing === "overdue" ? timing : "done",
      partly: open.length > 0 && answered.length > 0,
      loggedBy,
      passLogId: answered.map((s) => s.dose!.details.passLogId).find((id) => !!id) ?? null,
    };
  });
  const order = (p: DuePass) => (p.passId ? 0 : 1);
  const label = (p: DuePass) => p.name ?? p.slots[0]?.medication.name ?? "";
  return out.sort(
    (a, b) =>
      a.at.localeCompare(b.at) ||
      order(a) - order(b) ||
      label(a).localeCompare(label(b), undefined, { sensitivity: "base" }) ||
      a.key.localeCompare(b.key),
  );
}

/** Whether a pass still wants doses now (due or overdue, partly done or not). */
export const isPassDueNow = (pass: DuePass) => pass.state === "due" || pass.state === "overdue";

/** A named pass (not a time of its own). */
export const isNamedPass = (pass: DuePass): pass is DuePass & { passId: string; name: string } =>
  !!pass.passId && !!pass.name;

/** UUID v5 namespace of a slot's dose ids (`doseSlotId`). Never change it: ids already written use it. */
export const DOSE_SLOT_NAMESPACE = "846cc01a-9a20-4ddf-b3ef-232fb19ea155";
/** UUID v5 namespace of a pass's round ids (`passRoundId`). Never change it: ids already written use it. */
export const PASS_ROUND_NAMESPACE = "ab6f6bf5-b1a8-4e64-9897-b1c05ef519cf";

/** How far a dose reaches for its slot, in minutes: `dueDoses`'s default window. */
const SLOT_REACH_MINUTES = 120;

/**
 * The recipient's day of the slot a dose at `occurredAt` is for: the day of
 * that time's nearest moment within the window, else the day it was given.
 * The same reach as the matching in `dueDoses`, so a 23:30 dose given at 00:10
 * belongs to last night and a 20:00 dose given at 07:00 to today.
 */
export const doseSlotDay = ({
  occurredAt,
  time,
  timeZone,
  windowMinutes = SLOT_REACH_MINUTES,
}: {
  occurredAt: string | Date;
  /** The slot's time, "HH:MM" in the recipient's zone. */
  time: string;
  timeZone: string;
  windowMinutes?: number;
}) => {
  const at = new Date(occurredAt);
  const ms = at.getTime();
  const given = dayInZone(at, timeZone);
  let best: { day: string; off: number } | null = null;
  for (const day of [addDays(given, -1), given, addDays(given, 1)]) {
    const off = Math.abs(zonedInstant(day, time, timeZone).getTime() - ms);
    if (off <= windowMinutes * 60_000 && (!best || off < best.off)) best = { day, off };
  }
  return best?.day ?? given;
};

/**
 * The id two members' same answer for one slot shares: from the medication,
 * the slot's day, the slot (its pass's id, else its time) and the answer, so
 * Given and Skipped for one slot stay two rows.
 */
export const doseSlotId = (
  medicationId: string,
  day: string,
  slotKey: string,
  status: DoseDetails["status"],
) => uuidV5(`${medicationId.toLowerCase()}:${day}:${slotKey.toLowerCase()}:${status}`, DOSE_SLOT_NAMESPACE);

/** The round id two members share for one pass on one day (`DuePass.key`). */
export const passRoundId = (passKey: string, day: string) =>
  uuidV5(`${passKey.toLowerCase()}:${day}`, PASS_ROUND_NAMESPACE);

/**
 * The flag on a device's PATCH of a dose it still holds as its own (`_metadata`
 * on the upload's op, B-614). If the server's row turns out to be another
 * member's, this device's PUT was a duplicate, so its edit or Undo was of its
 * own tap and leaves their dose alone. A PATCH of a dose the device shows as
 * another member's has no flag: that's a deliberate change of the shared row.
 */
export const OWN_DOSE_COPY_METADATA = "dose:ownCopy";

/**
 * The slot id a dose gets, or null for a dose naming no slot (it takes a
 * random id). Every dose writer asks here, and uses the answer only when no
 * row with that id exists where it writes, live or deleted: a deliberate
 * extra dose, or one logged again after an Undo, is a new row.
 */
export const doseSlotIdFor = (
  dose: Pick<DoseDetails, "medicationId" | "status"> & {
    passId?: string | null;
    scheduledFor?: string | null;
    occurredAt: string | Date;
  },
  {
    timeZone,
    passTime,
    windowMinutes,
  }: {
    /** The recipient's zone. */
    timeZone: string;
    /** The time its pass falls at now, when it names a live pass. */
    passTime?: string | null;
    windowMinutes?: number;
  },
) => {
  const slotKey = dose.passId || dose.scheduledFor;
  if (!slotKey) return null;
  const time = (dose.passId && passTime) || dose.scheduledFor;
  const day = time
    ? doseSlotDay({ occurredAt: dose.occurredAt, time, timeZone, windowMinutes })
    : dayInZone(new Date(dose.occurredAt), timeZone);
  return doseSlotId(dose.medicationId, day, slotKey, dose.status);
};

/** The round a new dose in this pass joins: the pass's, else the one its key and day derive. */
export const passLogIdFor = (pass: Pick<DuePass, "passLogId" | "key" | "slots">) => {
  if (pass.passLogId) return pass.passLogId;
  const day = pass.slots[0]?.day;
  return day ? passRoundId(pass.key, day) : crypto.randomUUID();
};

/**
 * A dose to log, as the device's `logDoses` takes it (a plain shape, so the wording and the
 * connector share it with the device).
 */
export type DoseInput = Omit<DoseDetails, "medicationId"> & {
  medicationId: string;
  /** When it was given, skipped or refused (ISO 8601). Now, when left out. */
  occurredAt?: string;
  /** The device's IANA zone, when left out. */
  timeZone?: string;
};

/** One dose Given all writes, as `logDoses` takes it. */
export type GivenAllWrite = DoseInput & { occurredAt: string; passLogId: string };

/**
 * The doses Given all writes for a pass: one per open slot, given now, with
 * the slot's amount, its time (`scheduledFor`), its pass and one round
 * (`passLogId`: the round already started in the pass, else `passRoundId`).
 * Answered slots are left alone, so a dose someone else logged isn't doubled.
 */
export function givenAllWrites(
  pass: Pick<DuePass, "open" | "passLogId" | "key" | "slots">,
  now: Date,
): GivenAllWrite[] {
  if (!pass.open.length) return [];
  const passLogId = passLogIdFor(pass);
  const occurredAt = now.toISOString();
  return pass.open.map((slot) => ({
    medicationId: slot.medication.id,
    status: "given",
    amount: slot.amount,
    scheduledFor: slot.time,
    passId: slot.passId,
    passLogId,
    occurredAt,
  }));
}

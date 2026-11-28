import type { MedicationSchedule, PassLike } from "@caretook/data/schema";

import { isPassSlot, withoutPass } from "@caretook/data/schema";

// The schedule form's starting state (`ScheduleFields`): which passes are
// ticked, with their amounts, and the rows of times of their own. Pure, so
// web:unit tests it.

/** A time-of-its-own row: its key stays put as rows come and go. */
export type TimeRow = { key: number; value: string; amount: string };

export type InitialSlots = {
  /** Ticked live passes by id, each with its amount ("" for the usual dose). */
  passes: Record<string, { amount: string }>;
  times: TimeRow[];
  /** Passes the schedule names that this device doesn't have: kept as they are. */
  unknown: string[];
};

/**
 * Where the form starts. A pass deleted since the schedule was saved reads
 * as a time of its own at the pass's last time (`withoutPass`), as the
 * pass's deletion makes it everywhere else. A new medication (or one that
 * was as needed) starts with nothing ticked, and with one 8:00 row only
 * while the group has no passes to tick.
 */
export function initialSlots(
  initial: MedicationSchedule | null,
  passes: readonly (Pick<PassLike, "id" | "time"> & { deletedAt?: string | null })[],
): InitialSlots {
  const live = passes.filter((p) => !p.deletedAt);
  if (initial?.type !== "scheduled")
    return { passes: {}, times: live.length ? [] : [{ key: 0, value: "08:00", amount: "" }], unknown: [] };

  const known = new Map(passes.map((p) => [p.id, p]));
  const schedule = passes
    .filter((p) => p.deletedAt)
    .reduce<MedicationSchedule>((s, pass) => withoutPass(s, pass), initial);
  const slots = schedule.type === "scheduled" ? schedule.slots : [];

  const ticked: InitialSlots["passes"] = {};
  const unknown: string[] = [];
  const own: { time: string; amount: string }[] = [];
  for (const slot of slots) {
    if (!isPassSlot(slot)) own.push({ time: slot.time, amount: slot.amount ?? "" });
    else if (known.has(slot.passId)) ticked[slot.passId] = { amount: slot.amount ?? "" };
    else unknown.push(slot.passId);
  }
  return {
    passes: ticked,
    times: own
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(({ time, amount }, key) => ({ key, value: time, amount })),
    unknown,
  };
}

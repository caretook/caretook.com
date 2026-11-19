import type { DoseSlot, DueDoses } from "./dueDoses";
import type { PassLike } from "@caretook/data/schema";
import type { DoseInput } from "./sync/medications";

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

/** Today's passes: named passes in the day's order by time, then pass order; a time of its own after a pass at the same time. */
export function duePasses(
  due: Pick<DueDoses, "slots">,
  passes: readonly Pick<PassLike, "id" | "name" | "sortOrder">[],
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
  const order = (p: DuePass) => (p.passId ? (byId.get(p.passId)?.sortOrder ?? 0) : Number.MAX_SAFE_INTEGER);
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

/** The round a new dose in this pass joins: the pass's, else a new one. */
export const passLogIdFor = (
  pass: Pick<DuePass, "passLogId">,
  newId: () => string = () => crypto.randomUUID(),
) => pass.passLogId ?? newId();

/** One dose Given all writes, as `logDoses` takes it. */
export type GivenAllWrite = DoseInput & { occurredAt: string; passLogId: string };

/**
 * The doses Given all writes for a pass: one per open slot, given now, with
 * the slot's amount, its time (`scheduledFor`), its pass and one round
 * (`passLogId`: the round already started in the pass, else a new one).
 * Answered slots are left alone, so a dose someone else logged isn't doubled.
 */
export function givenAllWrites(
  pass: Pick<DuePass, "open" | "passLogId">,
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): GivenAllWrite[] {
  if (!pass.open.length) return [];
  const passLogId = passLogIdFor(pass, newId);
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

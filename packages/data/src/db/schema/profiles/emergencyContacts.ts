import { z } from "zod";

// The emergency list (profiles): one order across members (their
// membership's `emergency_rank`) and outside contacts (`emergencyRank` in the
// recipient's details). Pure and client-safe.

/** One place on the emergency list: a member, or an outside contact. */
export type EmergencyRef = { kind: "member"; userId: string } | { kind: "outside"; id: string };

export const emergencyRefKey = (ref: EmergencyRef) =>
  ref.kind === "member" ? `member:${ref.userId}` : `outside:${ref.id}`;

export const MAX_EMERGENCY_CONTACTS = 60;

export const emergencyRefZSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("member"), userId: z.uuid() }),
  z.strictObject({ kind: z.literal("outside"), id: z.uuid() }),
]);

/** The whole list, first to call first. Each contact at most once. */
export const emergencyOrderZSchema = z
  .array(emergencyRefZSchema)
  .max(MAX_EMERGENCY_CONTACTS)
  .superRefine((refs, ctx) => {
    const seen = new Set<string>();
    refs.forEach((ref, i) => {
      const key = emergencyRefKey(ref);
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "Listed twice" });
      seen.add(key);
    });
  });

type Ranked = { emergencyRank: number | null };

/**
 * The list in order, from the stored ranks: lowest rank first; on a tie (a
 * gap or a duplicate left by a removed member), members before outside
 * contacts, then by id. Anyone without a rank isn't on it.
 */
export const emergencyOrder = (
  members: readonly (Ranked & { userId: string })[],
  outside: readonly (Ranked & { id: string })[],
): EmergencyRef[] => {
  const ranked: { rank: number; ref: EmergencyRef }[] = [];
  for (const m of members) {
    if (m.emergencyRank != null)
      ranked.push({ rank: m.emergencyRank, ref: { kind: "member", userId: m.userId } });
  }
  for (const c of outside) {
    if (c.emergencyRank != null) ranked.push({ rank: c.emergencyRank, ref: { kind: "outside", id: c.id } });
  }
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.ref.kind === b.ref.kind ? 0 : a.ref.kind === "member" ? -1 : 1) ||
        emergencyRefKey(a.ref).localeCompare(emergencyRefKey(b.ref)),
    )
    .map((r) => r.ref);
};

/** Ranks 1…n for a list, by key (`emergencyRefKey`). */
export const emergencyRanks = (refs: readonly EmergencyRef[]) =>
  new Map(refs.map((ref, i) => [emergencyRefKey(ref), i + 1]));

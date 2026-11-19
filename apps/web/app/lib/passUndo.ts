// The last Given all on this page, for its Undo: "Morning logged · Undo" for
// about 10 s, wherever a `PassUndoStatus` is mounted (Today, the Dose sheet,
// the timeline's medication strip). One at a time: a newer round replaces it.
// Plain module state (no React), so a sheet that closes doesn't take the
// Undo with it. Pure apart from the clock; web:unit tests it.

/** How long Undo is offered. */
export const UNDO_MS = 10_000;

export type PassUndo = {
  /** A fresh key per round, so a status line announces each one. */
  key: string;
  groupId: string;
  /** "Morning logged". */
  label: string;
  /** Exactly the doses Given all wrote. */
  doseIds: readonly string[];
  /** Epoch ms after which Undo is no longer offered. */
  expiresAt: number;
};

let current: PassUndo | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Offer Undo for a round just logged. */
export function offerUndo(round: Omit<PassUndo, "key" | "expiresAt">, now = Date.now()) {
  current = { ...round, key: `${now}-${round.doseIds.join(",")}`, expiresAt: now + UNDO_MS };
  emit();
}

/** The round Undo is offered for in this group, or null (none, another group's, or expired). */
export function undoFor(groupId: string, now = Date.now()): PassUndo | null {
  return current && current.groupId === groupId && current.expiresAt > now ? current : null;
}

/** Stop offering Undo (after it's used, or once it expires). Only `key`'s, when given. */
export function clearUndo(key?: string) {
  if (!current || (key && current.key !== key)) return;
  current = null;
  emit();
}

export function subscribeUndo(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The current offer, for `useSyncExternalStore`. */
export const undoSnapshot = () => current;

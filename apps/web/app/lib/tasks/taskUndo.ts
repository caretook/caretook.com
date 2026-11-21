// The tasks ticked done on this page, for their Undo: "Done: Call the
// pharmacy · Undo" for about 10 s after each tick, wherever a
// `TaskUndoStatus` is mounted (the list, the task page, Upcoming, the simple
// card, `LinkedTasks`). Several at once, newest first, each with its own
// expiry; undoing one removes only it, and ticking the same task again
// replaces its entry. Plain module state (no React), like passUndo.ts. Pure
// apart from the clock; web:unit tests it.

/** How long Undo is offered, from each tick. */
export const TASK_UNDO_MS = 10_000;

export type TaskUndo = {
  /** A fresh key per tick, so a status line announces each one. */
  key: string;
  groupId: string;
  taskId: string;
  /** The task's title, for its Undo button's name ("Undo Call the pharmacy"). */
  title: string;
  /** "Done: Call the pharmacy". */
  label: string;
  /** Epoch ms after which Undo is no longer offered. */
  expiresAt: number;
};

const NONE: readonly TaskUndo[] = [];
/** Newest first. Replaced, never mutated, so it's a stable snapshot between changes. */
let offers: readonly TaskUndo[] = NONE;
const listeners = new Set<() => void>();
const set = (next: readonly TaskUndo[]) => {
  offers = next.length ? next : NONE;
  listeners.forEach((l) => l());
};

/** Offer Undo for a task just ticked done, ahead of the others (replacing this task's earlier offer). */
export function offerTaskUndo(tick: Omit<TaskUndo, "key" | "expiresAt">, now = Date.now()) {
  const offer = { ...tick, key: `${now}-${tick.taskId}`, expiresAt: now + TASK_UNDO_MS };
  set([offer, ...offers.filter((o) => o.taskId !== tick.taskId && o.expiresAt > now)]);
}

/** This group's live offers, newest first (none: an empty list). */
export function taskUndoFor(groupId: string, now = Date.now()): TaskUndo[] {
  return offers.filter((o) => o.groupId === groupId && o.expiresAt > now);
}

/** Stop offering one Undo (after it's used): `key`'s. With no key, every offer. */
export function clearTaskUndo(key?: string) {
  if (key === undefined) {
    if (offers.length) set(NONE);
    return;
  }
  if (offers.some((o) => o.key === key)) set(offers.filter((o) => o.key !== key));
}

/** Drop the offers whose time is up. */
export function pruneTaskUndo(now = Date.now()) {
  if (offers.some((o) => o.expiresAt <= now)) set(offers.filter((o) => o.expiresAt > now));
}

export function subscribeTaskUndo(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Every offer, for `useSyncExternalStore`. */
export const taskUndoSnapshot = (): readonly TaskUndo[] => offers;

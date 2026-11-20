// The last task ticked done on this page, for its Undo: "Done: Call the
// pharmacy · Undo" for about 10 s, wherever a `TaskUndoStatus` is mounted
// (the task list now; Upcoming, the strip and the simple card later). One
// at a time: a newer tick replaces it. Plain module state (no React), like
// passUndo.ts. Pure apart from the clock; web:unit tests it.

/** How long Undo is offered. */
export const TASK_UNDO_MS = 10_000;

export type TaskUndo = {
  /** A fresh key per tick, so a status line announces each one. */
  key: string;
  groupId: string;
  taskId: string;
  /** "Done: Call the pharmacy". */
  label: string;
  /** Epoch ms after which Undo is no longer offered. */
  expiresAt: number;
};

let current: TaskUndo | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Offer Undo for a task just ticked done. */
export function offerTaskUndo(tick: Omit<TaskUndo, "key" | "expiresAt">, now = Date.now()) {
  current = { ...tick, key: `${now}-${tick.taskId}`, expiresAt: now + TASK_UNDO_MS };
  emit();
}

/** The tick Undo is offered for in this group, or null (none, another group's, or expired). */
export function taskUndoFor(groupId: string, now = Date.now()): TaskUndo | null {
  return current && current.groupId === groupId && current.expiresAt > now ? current : null;
}

/** Stop offering Undo (after it's used, once it expires, or when the task is reopened). Only `key`'s, when given. */
export function clearTaskUndo(key?: string) {
  if (!current || (key && current.key !== key)) return;
  current = null;
  emit();
}

export function subscribeTaskUndo(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The current offer, for `useSyncExternalStore`. */
export const taskUndoSnapshot = () => current;

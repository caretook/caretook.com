// The todos ticked done on this page, for their Undo: "Done: Call the
// pharmacy · Undo" for about 10 s after each tick, wherever a
// `TodoUndoStatus` is mounted (the list, the todo page, Upcoming, the easy
// card, `LinkedTodos`). Several at once, newest first, each with its own
// expiry; undoing one removes only it, and ticking the same todo again
// replaces its entry. Plain module state (no React), like passUndo.ts. Pure
// apart from the clock; web:unit tests it.

/** How long Undo is offered, from each tick. */
export const TODO_UNDO_MS = 10_000;

export type TodoUndo = {
  /** A fresh key per tick, so a status line announces each one. */
  key: string;
  groupId: string;
  todoId: string;
  /** The todo's title, for its Undo button's name ("Undo Call the pharmacy"). */
  title: string;
  /** "Done: Call the pharmacy". */
  label: string;
  /** Epoch ms after which Undo is no longer offered. */
  expiresAt: number;
};

const NONE: readonly TodoUndo[] = [];
/** Newest first. Replaced, never mutated, so it's a stable snapshot between changes. */
let offers: readonly TodoUndo[] = NONE;
const listeners = new Set<() => void>();
const set = (next: readonly TodoUndo[]) => {
  offers = next.length ? next : NONE;
  listeners.forEach((l) => l());
};

/** Offer Undo for a todo just ticked done, ahead of the others (replacing this todo's earlier offer). */
export function offerTodoUndo(tick: Omit<TodoUndo, "key" | "expiresAt">, now = Date.now()) {
  const offer = { ...tick, key: `${now}-${tick.todoId}`, expiresAt: now + TODO_UNDO_MS };
  set([offer, ...offers.filter((o) => o.todoId !== tick.todoId && o.expiresAt > now)]);
}

/** This group's live offers, newest first (none: an empty list). */
export function todoUndoFor(groupId: string, now = Date.now()): TodoUndo[] {
  return offers.filter((o) => o.groupId === groupId && o.expiresAt > now);
}

/** Stop offering one Undo (after it's used): `key`'s. With no key, every offer. */
export function clearTodoUndo(key?: string) {
  if (key === undefined) {
    if (offers.length) set(NONE);
    return;
  }
  if (offers.some((o) => o.key === key)) set(offers.filter((o) => o.key !== key));
}

/** Drop the offers whose time is up. */
export function pruneTodoUndo(now = Date.now()) {
  if (offers.some((o) => o.expiresAt <= now)) set(offers.filter((o) => o.expiresAt > now));
}

export function subscribeTodoUndo(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Every offer, for `useSyncExternalStore`. */
export const todoUndoSnapshot = (): readonly TodoUndo[] => offers;

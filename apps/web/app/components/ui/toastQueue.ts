// The app's one toast queue (B-669), on React Aria's `ToastQueue`. Screens call
// `toast(...)` and `dismissToast(id)`; `ToastRegion` (Toast.tsx), mounted once
// in the /app layout, shows them. One toast is shown at a time, the newest:
// an older one waits behind it and comes back, with its full time, when the
// newer one goes. Module state, so a toast outlives the screen that showed it.

import type { QueuedToast } from "react-aria-components";

import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";

/** How long a toast stays, by default (React Aria asks for 5 s or more). */
export const TOAST_TIMEOUT = 6_000;

export type ToastAction = { label: string; onAction: () => void };

export type ToastOptions = {
  message: string;
  /** One action button; it runs once and closes the toast. */
  action?: ToastAction;
  /** An Undo button (before `action`): it runs once and closes the toast. */
  undo?: () => void;
  /** Milliseconds until it closes itself (paused while hovered or focused); `null` stays until dismissed or used. */
  timeout?: number | null;
  /** Data hooks on the toast (`data-*`). */
  data?: Record<`data-${string}`, string>;
};

export type ToastContent = Pick<ToastOptions, "message" | "data"> & { actions: ToastAction[] };

/** The key of the toast on screen (its component sets it), or null. */
let shownKey: string | null = null;
/** The key of the toast fading out: it stays in the queue until its fade ends. */
let exiting: string | null = null;
const exitListeners = new Set<() => void>();
const setExiting = (key: string | null) => {
  exiting = key;
  exitListeners.forEach((l) => l());
};

/**
 * React Aria's queue, but closing the toast on screen (dismissed, used or
 * timed out) first plays its fade out (`finishExit`), so no store read sees
 * it gone early. Anything else closes at once.
 */
class FadingQueue extends ToastQueue<ToastContent> {
  close(key: string) {
    if (key === shownKey && exiting !== key) {
      setExiting(key);
      return;
    }
    if (key === exiting) setExiting(null);
    super.close(key);
  }
}

export const queue = new FadingQueue({ maxVisibleToasts: 1 });

/** Show a toast; returns its id, for `dismissToast`. */
export function toast({ message, action, undo, timeout = TOAST_TIMEOUT, data }: ToastOptions): string {
  const actions = [...(undo ? [{ label: "Undo", onAction: undo }] : []), ...(action ? [action] : [])];
  return queue.add({ message, data, actions }, timeout === null ? {} : { timeout });
}

/** Close a toast, shown or waiting (its fade plays when shown). Nothing for one already gone. */
export function dismissToast(id: string) {
  queue.close(id);
}

/** Close every toast at once (tests, between screens). */
export function clearToasts() {
  if (exiting) setExiting(null);
  queue.clear();
}

/** Run one of a toast's actions: once, closing the toast first. */
export function runToastAction(toastItem: QueuedToast<ToastContent>, action: ToastAction) {
  if (!queue.visibleToasts.some((t) => t.key === toastItem.key) || exiting === toastItem.key) return;
  queue.close(toastItem.key);
  action.onAction();
}

/** The toast component says which toast is on screen, and when it leaves (`shown` false). */
export function markShown(key: string, shown: boolean) {
  if (shown) shownKey = key;
  else if (shownKey === key) shownKey = null;
}

/** The fade out has ended (or the toast left the screen first): close it for good. */
export function finishExit(key: string) {
  if (exiting === key) queue.close(key);
}

export const subscribeExit = (listener: () => void) => {
  exitListeners.add(listener);
  return () => void exitListeners.delete(listener);
};

/** The key of the toast fading out, for `useSyncExternalStore`. */
export const exitingKey = () => exiting;

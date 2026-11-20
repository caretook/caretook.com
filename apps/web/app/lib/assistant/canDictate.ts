import { useSyncExternalStore } from "react";

/** The parts of `navigator` the rule reads (so tests pass plain objects). */
export type DictationNav = Pick<Navigator, "userAgent"> & Partial<Pick<Navigator, "maxTouchPoints">>;

/**
 * Whether the keyboard has a microphone worth pointing at: a coarse pointer
 * (a touch screen is the main input) on an iOS or Android user agent. An iPad
 * in desktop mode says "Macintosh", so a Mac with more than one touch point
 * counts as an iPad. A touch Windows laptop, and any desktop, don't.
 */
export function canDictate(nav: DictationNav, coarsePointer = hasCoarsePointer()): boolean {
  if (!coarsePointer) return false;
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}

/** `(pointer: coarse)` on this device; false where it can't be asked. */
export function hasCoarsePointer(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

const never = () => () => {};

/** `canDictate(navigator)` for a component: false on the server and before hydration. */
export function useCanDictate(): boolean {
  return useSyncExternalStore(
    never,
    () => canDictate(navigator),
    () => false,
  );
}

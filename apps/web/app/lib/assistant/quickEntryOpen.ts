import { useEffect, useSyncExternalStore } from "react";

// Whether the quick entry sheet is open, and whether the frame offers it:
// module state, like the toast queue, so the opener (the /app frame's header
// button) needn't sit under the group layout that mounts the sheet
// (`QuickEntrySheet`). Its own module, not the quick entry folder's index
// (B-1071): the /app shell imports it, and the index brings the box, which
// reaches the device queries and, through them, yjs.

let open = false;
let offered = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
const setOpen = (next: boolean) => {
  if (open === next) return;
  open = next;
  notify();
};
const setOffered = (next: boolean) => {
  if (offered === next) return;
  offered = next;
  notify();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const isOpen = () => open;
const isOffered = () => offered;
const no = () => false;

/** Open the quick entry sheet (on a group page; elsewhere nothing shows it). */
export const openQuickEntry = () => setOpen(true);
/** Close the quick entry sheet. */
export const closeQuickEntry = () => setOpen(false);
/** Whether the quick entry sheet is open, now. */
export const quickEntryIsOpen = isOpen;
/** Whether the frame offers quick entry here, now. */
export const quickEntryIsOffered = isOffered;
/** Whether the quick entry sheet is open, live. */
export const useQuickEntryOpen = () => useSyncExternalStore(subscribe, isOpen, no);
/** Whether the frame offers quick entry here (its keys follow it), live. */
export const useQuickEntryOffered = () => useSyncExternalStore(subscribe, isOffered, no);

/** Hold the offer while `on` (exported for the unit test; the hook below is the API). */
export const offerQuickEntry = (on: boolean) => {
  setOffered(on);
  return () => setOffered(false);
};

/**
 * The frame says whether it offers quick entry here (its header button: on
 * group routes, not in the easy frame); the shortcut follows it.
 */
export function useOfferQuickEntry(on: boolean) {
  useEffect(() => offerQuickEntry(on), [on]);
}

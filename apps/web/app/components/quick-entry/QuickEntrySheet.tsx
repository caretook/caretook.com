import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useCachedSettings } from "~/lib/app-shell/me";
import { QuickEntryBox } from "./QuickEntryBox";
import { useQuickEntryShortcut } from "./useQuickEntryShortcut";

// Quick entry from any group page: the shared box in a kit `Sheet`, mounted
// once in the group layout (it needs the group) and opened from anywhere by
// `openQuickEntry` (the frame's header button, and the shortcut). The open
// state is module state, like the toast queue, so the opener needn't sit
// under the group layout. So is whether the frame offers it
// (`useOfferQuickEntry`): the shortcut works only where the button shows.

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
/** Whether the quick entry sheet is open, live. */
export const useQuickEntryOpen = () => useSyncExternalStore(subscribe, isOpen, no);

/**
 * The frame says whether it offers quick entry here (its header button: on
 * group routes, not in the easy frame); the shortcut follows it.
 */
export function useOfferQuickEntry(on: boolean) {
  useEffect(() => {
    setOffered(on);
    return () => setOffered(false);
  }, [on]);
}

/**
 * The quick entry sheet: the same `QuickEntryBox` as the timeline's, with
 * its own Undo, so it stays open after Save; Escape, Close or a tap outside
 * close it, and so does going to another page (the box's Edit, a draft).
 * Readers get it too: their lines show no Save (the box's role rule).
 * `/` and Cmd/Ctrl+K open it with the box focused (`useQuickEntryShortcut`).
 */
export function QuickEntrySheet() {
  const shown = useQuickEntryOpen();
  const keys = useSyncExternalStore(subscribe, isOffered, no);
  const field = useRef<HTMLTextAreaElement>(null);
  useQuickEntryShortcut({ on: keys, open: openQuickEntry, field });
  const group = useGroup();
  const { units } = useCachedSettings(group.userId);
  const { pathname } = useLocation();
  const opened = useRef(pathname);
  useEffect(() => {
    if (pathname !== opened.current) closeQuickEntry();
    opened.current = pathname;
  }, [pathname]);
  // Leaving the group (another group remounts the layout) closes it.
  useEffect(() => closeQuickEntry, []);
  return (
    <Sheet isOpen={shown} onOpenChange={(next) => !next && closeQuickEntry()} title="Quick entry">
      <QuickEntryBox groupId={group.id} units={units} fieldRef={field} />
    </Sheet>
  );
}

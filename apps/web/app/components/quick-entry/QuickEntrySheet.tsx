import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useCachedSettings } from "~/lib/app-shell/me";
import { QuickEntryBox } from "./QuickEntryBox";

// Quick entry from any group page: the shared box in a kit `Sheet`, mounted
// once in the group layout (it needs the group) and opened from anywhere by
// `openQuickEntry` (the frame's header button; later the shortcut). The open
// state is module state, like the toast queue, so the opener needn't sit
// under the group layout.

let open = false;
const listeners = new Set<() => void>();
const setOpen = (next: boolean) => {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const isOpen = () => open;
const closed = () => false;

/** Open the quick entry sheet (on a group page; elsewhere nothing shows it). */
export const openQuickEntry = () => setOpen(true);
/** Close the quick entry sheet. */
export const closeQuickEntry = () => setOpen(false);
/** Whether the quick entry sheet is open, live. */
export const useQuickEntryOpen = () => useSyncExternalStore(subscribe, isOpen, closed);

/**
 * The quick entry sheet: the same `QuickEntryBox` as the timeline's, with
 * its own Undo, so it stays open after Save; Escape, Close or a tap outside
 * close it, and so does going to another page (the box's Edit, a draft).
 * Readers get it too: their lines show no Save (the box's role rule).
 */
export function QuickEntrySheet() {
  const shown = useQuickEntryOpen();
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
      <QuickEntryBox groupId={group.id} units={units} />
    </Sheet>
  );
}

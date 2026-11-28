import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useCachedSettings } from "~/lib/app-shell/me";
import {
  closeQuickEntry,
  openQuickEntry,
  useQuickEntryOffered,
  useQuickEntryOpen,
} from "~/lib/assistant/quickEntryOpen";
import { QuickEntryBox } from "./QuickEntryBox";
import { useQuickEntryShortcut } from "./useQuickEntryShortcut";

// Quick entry from any group page: the shared box in a kit `Sheet`, mounted
// once in the group layout (it needs the group) and opened from anywhere by
// `openQuickEntry` (the frame's header button, and the shortcut). The open
// state lives in `lib/assistant/quickEntryOpen`, so the /app shell can open
// it without loading the box (B-1071). So does whether the frame offers it
// (`useOfferQuickEntry`): the shortcut works only where the button shows.

/**
 * The quick entry sheet: the same `QuickEntryBox` as the timeline's, with
 * its own Undo, so it stays open after Save; Escape, Close or a tap outside
 * close it, and so does going to another page (the box's Edit, a draft).
 * Readers get it too: their lines show no Save (the box's role rule).
 * `/` and Cmd/Ctrl+K open it with the box focused (`useQuickEntryShortcut`).
 */
export function QuickEntrySheet() {
  const shown = useQuickEntryOpen();
  const keys = useQuickEntryOffered();
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

import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconButton } from "./IconButton";
import { useSheetChanges } from "./useSheetChanges";
import { NavigationHold, useSheetExit } from "./useSheetExit";

/** What had focus as the sheet mounted. A menu item is gone by the close, so its menu's trigger instead. */
function findOpener() {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  const trigger = active?.closest<HTMLElement>('[role="menu"]')?.dataset.menuOf;
  return (trigger && document.querySelector(`[data-menu-trigger="${CSS.escape(trigger)}"]`)) || active;
}

/**
 * The full screen on phones (below `sm`: the whole viewport, no gap above for
 * the header, the safe-area insets kept, its own scroll), a centered dialog on
 * wider screens, named by its
 * `title` (React Aria: focus moves in and is trapped, Escape, a tap outside
 * and Close close it, and focus returns to the opener). Its overlay is
 * `z-50`, above the tab bar (`z-40`).
 *
 * Sheets are routes, so they usually close by unmounting. React Aria then
 * returns focus only when its own bookkeeping allows; as a backstop, if focus
 * is left on the page body, it goes back to whatever had it when the sheet
 * mounted.
 *
 * It closes the way it opened (`useSheetExit`): a dismissal plays the exit and
 * then calls `onOpenChange(false)`; a navigation that changes the path is held
 * for the exit. Under "reduce motion" nothing is held.
 *
 * `guardChanges` (a sheet that edits data): once its form differs from where
 * it started, Close, Escape, a tap outside and Back ask "Discard changes?"
 * first. A save and the form's own Cancel don't ask, nor does a value a sync
 * put there. Back from a sheet on top asks for a changed one under it. A
 * caller whose record was deleted elsewhere passes `false` before closing.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  guardChanges = false,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** `true` watches the whole sheet; a selector watches just that form (a sheet that also lists and saves). */
  guardChanges?: boolean | string;
  children: ReactNode;
}) {
  const [opener] = useState(findOpener);
  useEffect(
    () => () => {
      // After React Aria's own restore (the next frame).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (document.activeElement !== document.body) return;
          if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus();
        }),
      );
    },
    [opener],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const hasChanges = useSheetChanges(panelRef, guardChanges, isOpen);
  const { closing, dismiss, asking, keepEditing, discard, hold } = useSheetExit({
    isOpen,
    onOpenChange,
    panelRef,
    hasChanges,
  });

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={dismiss}
      isDismissable
      data-sheet="overlay"
      data-closing={closing || undefined}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
    >
      {hold && <NavigationHold {...hold} />}
      <Modal
        ref={panelRef}
        data-sheet="panel"
        data-closing={closing || undefined}
        className="bg-base-100 sm:rounded-box h-dvh w-full overflow-y-auto overscroll-contain pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] shadow-xl sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:p-6"
      >
        <Dialog className="outline-none">
          {({ close }) => (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Heading slot="title" className="text-lg font-semibold">
                  {title}
                </Heading>
                <IconButton label="Close" icon={X} onPress={close} />
              </div>
              {children}
              {/* An unguarded sheet asks too, for a changed sheet under it that Back would close. */}
              {(guardChanges !== false || asking) && (
                <ConfirmDialog
                  open={asking}
                  title="Discard changes?"
                  message="What you changed here won't be saved."
                  confirmLabel="Discard"
                  cancelLabel="Keep editing"
                  onConfirm={discard}
                  onClose={keepEditing}
                />
              )}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

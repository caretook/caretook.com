import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "./IconButton";
import { NavigationHold, useSheetExit } from "./useSheetExit";

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
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
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
  const { closing, dismiss, hold } = useSheetExit({ isOpen, onOpenChange, panelRef });

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
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

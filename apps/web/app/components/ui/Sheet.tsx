import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "./IconButton";

/**
 * A bottom sheet on phones, a centered dialog on wider screens, named by its
 * `title` (React Aria: focus moves in and is trapped, Escape, a tap outside
 * and Close close it, and focus returns to the opener). Its overlay is
 * `z-50`, above the tab bar (`z-40`).
 *
 * Sheets are routes, so they usually close by unmounting. React Aria then
 * returns focus only when its own bookkeeping allows; as a backstop, if focus
 * is left on the page body, it goes back to whatever had it when the sheet
 * mounted.
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

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 data-[entering]:motion-safe:animate-[fade-in_150ms_ease-out]"
    >
      <Modal className="bg-base-100 rounded-t-box sm:rounded-box max-h-[92dvh] w-full overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:p-6 data-[entering]:motion-safe:animate-[sheet-in_200ms_ease-out]">
        <Dialog className="outline-none">
          {({ close }) => (
            <>
              <div className="bg-base-300 mx-auto mb-2 h-1 w-10 rounded-full sm:hidden" aria-hidden="true" />
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

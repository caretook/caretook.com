import type { ReactNode } from "react";

import { X } from "lucide-react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

/**
 * A bottom sheet on phones, a centered dialog on wider screens (React Aria:
 * focus trap, Esc and outside-tap to close, focus returns to the opener).
 */
export function EntrySheet({
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
                <Button aria-label="Close" className="btn btn-ghost btn-sm btn-square" onPress={close}>
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              {children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

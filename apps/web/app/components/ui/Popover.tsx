import type { ReactNode } from "react";

import { Button, Dialog, DialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { SURFACE } from "./styles";

type Placement = "bottom start" | "bottom end";
type Content = ReactNode | ((close: () => void) => ReactNode);

/**
 * A button that opens a small dialog beside it (React Aria: tap or
 * Enter/Space to open, focus moves in, Escape or a tap outside closes it,
 * focus returns to the button). `children` may be a function of `close`, for
 * a Done button.
 */
export function Popover({
  label,
  dialogLabel,
  trigger,
  className,
  placement = "bottom start",
  onOpenChange,
  defaultOpen,
  children,
}: {
  /** The button's accessible name. */
  label: string;
  /** The dialog's accessible name. */
  dialogLabel: string;
  /** The button's content. */
  trigger: ReactNode;
  /** Classes for the button (the outer element). */
  className?: string;
  placement?: Placement;
  onOpenChange?: (open: boolean) => void;
  /** Open as it mounts (the time chip on a draft that asks for a day first). */
  defaultOpen?: boolean;
  children: Content;
}) {
  return (
    <DialogTrigger onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      <Button aria-label={label} className={className}>
        {trigger}
      </Button>
      <PopoverPanel label={dialogLabel} placement={placement} width="md">
        {children}
      </PopoverPanel>
    </DialogTrigger>
  );
}

/**
 * The popover's panel alone, for a React Aria control that brings its own
 * trigger (the date field's "Pick a date"). Internal to ui/.
 */
export function PopoverPanel({
  label,
  placement = "bottom start",
  width = "auto",
  children,
}: {
  /** The dialog's accessible name (else the control labels it). */
  label?: string;
  placement?: Placement;
  width?: "auto" | "md";
  children: Content;
}) {
  return (
    <AriaPopover
      placement={placement}
      className={`${SURFACE} max-w-[calc(100vw-2rem)] p-3 ${width === "md" ? "w-72" : ""}`}
    >
      <Dialog aria-label={label} className="space-y-2 outline-none">
        {({ close }) => (typeof children === "function" ? children(close) : children)}
      </Dialog>
    </AriaPopover>
  );
}

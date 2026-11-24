import type { ReactNode } from "react";
import type { ButtonLook } from "./buttonClass";

import { Button, Dialog, DialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { buttonClass } from "./buttonClass";
import { SURFACE } from "./styles";

type Placement = "bottom start" | "bottom end";
type Content = ReactNode | ((close: () => void) => ReactNode);

/**
 * A button that opens a small dialog beside it (React Aria: tap or
 * Enter/Space to open, focus moves in, Escape or a tap outside closes it,
 * focus returns to the button). `children` may be a function of `close`, for
 * a Done button. It fades in and out (`motion-overlay`, `--motion-fast`) and
 * leaves the DOM after its exit.
 */
export function Popover({
  label,
  dialogLabel,
  trigger,
  className,
  variant,
  size,
  shape,
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
  /** With a look, outer classes for the button; without one, its whole class string. */
  className?: string;
  /** The trigger's look, as a `Button`'s. */
  variant?: ButtonLook["variant"];
  size?: ButtonLook["size"];
  shape?: ButtonLook["shape"];
  placement?: Placement;
  onOpenChange?: (open: boolean) => void;
  /** Open as it mounts (the time chip on a draft that asks for a day first). */
  defaultOpen?: boolean;
  children: Content;
}) {
  const look =
    variant || size || shape
      ? `${buttonClass({ variant, size, shape })} ${className ?? ""}`.trim()
      : className;
  return (
    <DialogTrigger onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      <Button aria-label={label} className={look}>
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
      className={`${SURFACE} motion-overlay max-w-[calc(100vw-2rem)] p-3 ${width === "md" ? "w-72" : ""}`}
    >
      <Dialog aria-label={label} className="space-y-2 outline-none">
        {({ close }) => (typeof children === "function" ? children(close) : children)}
      </Dialog>
    </AriaPopover>
  );
}

import type { ReactElement, ReactNode } from "react";

import { Focusable, Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import { SURFACE } from "../styles";

/**
 * A hint beside a control (React Aria): it opens on hover and on keyboard
 * focus, never on touch, and closes on Escape, a press, or when the pointer
 * or focus leaves. It's the control's description (`aria-describedby`),
 * never its name, so the child keeps its own label.
 *
 * `children` is one focusable element that forwards its ref and spreads the
 * props it's given (a native element, or React Router's `Link`).
 */
export function Tooltip({
  content,
  placement = "top",
  children,
}: {
  content: ReactNode;
  placement?: "top" | "bottom" | "start" | "end";
  children: ReactElement;
}) {
  return (
    <TooltipTrigger delay={500} closeDelay={150}>
      {/* Focusable types its child as a DOM element; a component that forwards its ref works the same. */}
      <Focusable>{children as ReactElement<object, string>}</Focusable>
      <AriaTooltip
        placement={placement}
        offset={6}
        data-tooltip=""
        className={`${SURFACE} z-50 max-w-[calc(100vw-2rem)] px-2.5 py-1.5 text-sm`}
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}

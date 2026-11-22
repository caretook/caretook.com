import type { ReactNode } from "react";

import { useState } from "react";

type DataHooks = { [attr: `data-${string}`]: string | undefined };

/**
 * A region that slides open and closed (height, or with `axis="inline"`
 * width) with the kit's motion, and switches at once under "reduce motion".
 * Closed, its content stays mounted but is out of the accessibility tree and
 * can't take focus. The toggle is the caller's: it carries `aria-expanded`
 * and `aria-controls` (this region's `id`). `className` (a margin, a flex
 * share) and `data-*` hooks go on the region. The rules are `app.css`'s
 * `[data-collapse]`.
 */
export function Collapse({
  open,
  id,
  axis = "block",
  className,
  children,
  ...data
}: {
  open: boolean;
  id?: string;
  /** `block` slides its height (the default), `inline` its width (a field in a row). */
  axis?: "block" | "inline";
  className?: string;
  children: ReactNode;
} & DataHooks) {
  // Open and done moving: the content may show past the edges (focus rings).
  const [settled, setSettled] = useState(open);
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    setSettled(false);
  }
  return (
    <div
      {...data}
      id={id}
      data-collapse={axis}
      data-open={open ? "" : undefined}
      data-settled={open && settled ? "" : undefined}
      inert={!open}
      className={className}
      onTransitionEnd={(e) => {
        if (open && e.target === e.currentTarget) setSettled(true);
      }}
    >
      <div>{children}</div>
    </div>
  );
}

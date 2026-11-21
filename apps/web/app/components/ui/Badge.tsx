import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeTone } from "./badgeClass";

import { badgeClass } from "./badgeClass";

/**
 * A small soft label ("This device", "Past"). One size; the tone is from the
 * status tones table (`STATUS_TONE`) when it's a status. `ViaTag` is separate.
 */
export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className = "",
  ...data
}: {
  tone?: BadgeTone;
  /** A leading icon (decorative: the text says what it is). */
  icon?: LucideIcon;
  children: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  return (
    <span {...data} className={`${badgeClass(tone)} ${className}`.trim()}>
      {Icon && <Icon aria-hidden="true" className="size-3" />}
      {children}
    </span>
  );
}

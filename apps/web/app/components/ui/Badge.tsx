import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeTone } from "./badgeClass";

import { badgeClass } from "./badgeClass";

/**
 * A small soft label ("This device", "Past"). One size; the tone is from the
 * status tones table (`STATUS_TONE`) when it's a status, or a palette `fill`
 * (a tag's color, `tagColorClass`) in its place. `ViaTag` is separate.
 */
export function Badge({
  tone = "neutral",
  fill,
  icon: Icon,
  children,
  className = "",
  ...data
}: {
  tone?: BadgeTone;
  /** A palette fill's whole classes (`tagColorClass`) in place of the tone; undefined keeps the tone. */
  fill?: string;
  /** A leading icon (decorative: the text says what it is). */
  icon?: LucideIcon;
  children: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  return (
    <span {...data} className={`${fill ? `badge badge-sm ${fill}` : badgeClass(tone)} ${className}`.trim()}>
      {Icon && <Icon aria-hidden="true" className="size-3" />}
      {children}
    </span>
  );
}

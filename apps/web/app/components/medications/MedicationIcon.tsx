import type { LucideIcon } from "lucide-react";

import { Pill } from "lucide-react";

/** The glyph inside `MedicationIcon`, for places that take a bare icon (the "Link to" box's options). */
export const MEDICATION_GLYPH: LucideIcon = Pill;

/**
 * A medication's one icon: the pill in a circle, the primary tint, muted
 * (faint on a quiet fill) when it's stopped or removed. Decorative: the
 * name beside it says what it is.
 */
export function MedicationIcon({ muted = false, className = "" }: { muted?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-full ${muted ? "bg-base-200 text-faint" : "bg-primary/15 text-primary"} ${className}`.trim()}
      data-medication-icon=""
    >
      <MEDICATION_GLYPH className="size-4" />
    </span>
  );
}

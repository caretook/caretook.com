import { Pill } from "lucide-react";

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
      <Pill className="size-4" />
    </span>
  );
}

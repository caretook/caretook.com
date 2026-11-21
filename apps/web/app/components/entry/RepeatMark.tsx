import { Repeat } from "lucide-react";

/**
 * The mark on a repeating series' visit (appointments-2), beside its time
 * in rows, cards and the Today card: a lucide `Repeat`, named "Repeats" for
 * screen readers. Nothing for a one-off.
 */
export function RepeatMark({ seriesId, className = "" }: { seriesId: string | null; className?: string }) {
  if (!seriesId) return null;
  return (
    <span
      className={`inline-flex items-center align-[-0.125em] ${className}`}
      title="Repeats"
      data-repeat-mark
    >
      <Repeat className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Repeats</span>
    </span>
  );
}

import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * The one turning chevron of an expander (a disclosure's toggle, a menu
 * group): `open` turns it a quarter (pointing right when closed, down when
 * open) or, with `closed="down"`, a half (down, then up). It turns with the
 * kit's motion (`motion-turn`, none under "reduce motion") and is hidden from
 * the accessibility tree: the toggle's `aria-expanded` says the state.
 * `className` sizes it (`size-4` by default).
 */
export function Chevron({
  open,
  closed = "right",
  className = "size-4",
}: {
  open: boolean;
  /** Which way it points while closed. */
  closed?: "right" | "down";
  className?: string;
}) {
  const Icon = closed === "down" ? ChevronDown : ChevronRight;
  const turn = !open ? "" : closed === "down" ? "rotate-180" : "rotate-90";
  return (
    <Icon
      aria-hidden="true"
      data-chevron={open ? "open" : "closed"}
      className={`motion-turn shrink-0 ${turn} ${className}`.trim()}
    />
  );
}

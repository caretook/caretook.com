import type { LucideIcon } from "lucide-react";
import type { Ref } from "react";

/**
 * A small square button that shows only an icon. `label` is required: it's
 * the accessible name and the tooltip. With `pressed` it's a toggle
 * (`aria-pressed`; filled when on, outlined when off); otherwise a ghost button.
 * With `expanded` it's a disclosure (`aria-expanded`, and `aria-controls` with
 * `controls`); `ref` reaches the button, to return focus to it.
 */
export function IconButton({
  label,
  icon: Icon,
  onPress,
  pressed,
  expanded,
  controls,
  ref,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  pressed?: boolean;
  /** A disclosure's state: what it shows is open. */
  expanded?: boolean;
  /** The id of what it shows or hides. */
  controls?: string;
  ref?: Ref<HTMLButtonElement>;
  /** Classes for the button (the outer element), such as `join-item`. */
  className?: string;
}) {
  const tone =
    pressed === undefined ? "btn-ghost" : pressed ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100";
  return (
    <button
      type="button"
      aria-label={label}
      ref={ref}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      onClick={onPress}
      className={`btn btn-sm btn-square ${tone} ${className}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

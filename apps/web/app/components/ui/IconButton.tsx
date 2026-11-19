import type { LucideIcon } from "lucide-react";

/**
 * A small square button that shows only an icon. `label` is required: it's
 * the accessible name and the tooltip. With `pressed` it's a toggle
 * (`aria-pressed`; filled when on, outlined when off); otherwise a ghost button.
 */
export function IconButton({
  label,
  icon: Icon,
  onPress,
  pressed,
  disabled,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  pressed?: boolean;
  /** Not available now (a Move up on the first row). */
  disabled?: boolean;
  /** Classes for the button (the outer element), such as `join-item`. */
  className?: string;
}) {
  const tone =
    pressed === undefined ? "btn-ghost" : pressed ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      onClick={onPress}
      className={`btn btn-sm btn-square ${tone} ${className}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

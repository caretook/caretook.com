import type { LucideIcon } from "lucide-react";
import type { Ref } from "react";
import type { To } from "react-router";

import { Link } from "react-router";

/**
 * A small square button that shows only an icon. `label` is required: it's
 * the accessible name and the tooltip. With `pressed` it's a toggle
 * (`aria-pressed`; filled when on, outlined when off); otherwise a ghost button.
 * With `expanded` it's a disclosure (`aria-expanded`, and `aria-controls` with
 * `controls`); `ref` reaches the button, to return focus to it.
 * With `to` instead of `onPress` it's a link that looks the same (loaded
 * ahead with `prefetch="render"`, so it opens offline too).
 */
export function IconButton({
  label,
  icon: Icon,
  onPress,
  pressed,
  expanded,
  controls,
  ref,
  to,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  /** Classes for the button (the outer element), such as `join-item`. */
  className?: string;
} & (
  | {
      onPress: () => void;
      pressed?: boolean;
      /** A disclosure's state: what it shows is open. */
      expanded?: boolean;
      /** The id of what it shows or hides. */
      controls?: string;
      ref?: Ref<HTMLButtonElement>;
      to?: never;
    }
  | {
      to: To;
      onPress?: never;
      pressed?: never;
      expanded?: never;
      controls?: never;
      ref?: never;
    }
)) {
  const tone =
    pressed === undefined ? "btn-ghost" : pressed ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100";
  if (to !== undefined)
    return (
      <Link
        to={to}
        prefetch="render"
        aria-label={label}
        title={label}
        className={`btn btn-sm btn-square btn-ghost ${className}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </Link>
    );
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

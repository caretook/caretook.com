import type { LucideIcon } from "lucide-react";
import type { Ref } from "react";
import type { To } from "react-router";

import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

/**
 * A small square button that shows only an icon. `label` is required: it's
 * the accessible name and the tooltip. With `pressed` it's a toggle
 * (`aria-pressed`; filled when on, outlined when off); otherwise a ghost button.
 * With `expanded` it's a disclosure (`aria-expanded`, and `aria-controls` with
 * `controls`); `ref` reaches the button, to return focus to it.
 * With `to` instead of `onPress` it's a link that looks the same (loaded
 * ahead with `prefetch="render"`, so it opens offline too).
 * `size="md"` is the larger button with a larger icon (a page header's menu
 * button); the default is small.
 */
export function IconButton({
  label,
  icon: Icon,
  onPress,
  pressed,
  disabled,
  expanded,
  controls,
  ref,
  to,
  size = "sm",
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  /** Not available now (a Move up on the first row). */
  disabled?: boolean;
  /** `sm` (the default) or `md`. */
  size?: "sm" | "md";
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
  const ghost = buttonClass({ variant: "ghost", size, shape: "square" });
  const iconSize = size === "md" ? "size-6" : "size-4";
  const look =
    pressed === undefined
      ? ghost
      : pressed
        ? `${buttonClass({ size, shape: "square" })} btn-neutral`
        : `${ghost} border-base-300 bg-base-100`;
  if (to !== undefined)
    return (
      <Link to={to} prefetch="render" aria-label={label} title={label} className={`${ghost} ${className}`}>
        <Icon className={iconSize} aria-hidden="true" />
      </Link>
    );
  return (
    <button
      type="button"
      aria-label={label}
      ref={ref}
      aria-pressed={pressed}
      disabled={disabled}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      onClick={onPress}
      className={`${look} ${className}`}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </button>
  );
}

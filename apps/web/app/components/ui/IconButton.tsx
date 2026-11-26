import type { LucideIcon } from "lucide-react";
import type { Ref } from "react";
import type { To } from "react-router";

import { Button } from "./Button";

/**
 * The icon-only `Button`, by a short name: a small square ghost button that
 * shows only an icon. `label` is required: it's the accessible name and the
 * tooltip. With `pressed` it's a toggle (`aria-pressed`; filled when on,
 * outlined when off). With `expanded` it's a disclosure (`aria-expanded`, and
 * `aria-controls` with `controls`); `ref` reaches the button, to return focus
 * to it. With `to` instead of `onPress` it's a link that looks the same
 * (loaded ahead with `prefetch="render"`, so it opens offline too).
 * `size="md"` is the larger button with a larger icon (a page header's menu
 * button); the default is small. `count` shows a badge at its corner (a list
 * tool's Filter: put the count in `label` too), `haspopup` says it opens a
 * dialog, and `data-*` attributes reach the element.
 */
export function IconButton({
  label,
  icon,
  onPress,
  pressed,
  disabled,
  expanded,
  controls,
  ref,
  to,
  size = "sm",
  className,
  count,
  haspopup,
  ...data
}: {
  label: string;
  icon: LucideIcon;
  /** Not available now (a Move up on the first row). */
  disabled?: boolean;
  /** `sm` (the default) or `md`. */
  size?: "sm" | "md";
  /** Classes for the button (the outer element), such as `join-item`. */
  className?: string;
  /** A count badge at its corner; none at 0. */
  count?: number;
  /** It opens a dialog (`aria-haspopup`). */
  haspopup?: "dialog";
  [attr: `data-${string}`]: string | undefined;
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
  if (to !== undefined)
    return (
      <Button
        to={to}
        prefetch="render"
        variant="ghost"
        size={size}
        icon={icon}
        label={label}
        count={count}
        className={className}
        {...data}
      />
    );
  return (
    <Button
      variant="ghost"
      size={size}
      icon={icon}
      label={label}
      onClick={onPress}
      pressed={pressed}
      disabled={disabled}
      expanded={expanded}
      controls={controls}
      ref={ref}
      count={count}
      aria-haspopup={haspopup}
      className={className}
      {...data}
    />
  );
}

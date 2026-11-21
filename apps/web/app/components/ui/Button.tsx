import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import type { LinkProps } from "react-router";
import type { ButtonLook } from "./buttonClass";

import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

type Look = Pick<ButtonLook, "variant" | "size" | "block"> & {
  /** A leading icon (decorative: the text names the button). */
  icon?: LucideIcon;
  children: ReactNode;
  /** Classes for the outer element (a margin, `grow`), never its look. */
  className?: string;
};

type AsButton = Look &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "style" | "type"> & {
    /** "button" by default; a form's Save passes "submit". */
    type?: "button" | "submit" | "reset";
    /** Working: the button is disabled and shows `busyLabel` (when given) instead of its text. */
    busy?: boolean;
    /** What it says while busy ("Saving…"). */
    busyLabel?: string;
    ref?: Ref<HTMLButtonElement>;
    to?: never;
    href?: never;
  };

type AsLink = Look &
  Pick<LinkProps, "to" | "replace" | "state" | "prefetch"> & {
    busy?: never;
    busyLabel?: never;
    disabled?: never;
    /** For data hooks (`data-*`) and an `aria-label` when the text needs more. */
    [attr: `data-${string}`]: string | undefined;
    "aria-label"?: string;
    href?: never;
  };

type AsAnchor = Look & {
  /** A document navigation outside the router: another site, a `webcal:` link, a server route. */
  href: string;
  target?: "_blank";
  rel?: string;
  to?: never;
  busy?: never;
  busyLabel?: never;
  disabled?: never;
  /** For data hooks (`data-*`) and an `aria-label` when the text needs more. */
  [attr: `data-${string}`]: string | undefined;
  "aria-label"?: string;
};

/**
 * A text button in one of the kit's looks (`buttonClass`). With `to` it's a
 * router link that looks the same (and takes `replace`, `state`, `prefetch`);
 * with `href`, a plain `<a>` for a navigation the router doesn't own (another
 * site, a `webcal:` link, a server route such as an OAuth start). `busy`
 * disables it and swaps its text for `busyLabel`, so nothing is sent twice.
 * Icon-only buttons are `IconButton`.
 */
export function Button(props: AsButton | AsLink | AsAnchor) {
  const { variant, size, block, icon: Icon, children, className = "" } = props;
  const look = `${buttonClass({ variant, size, block })} ${className}`.trim();
  const iconSize = size === "xs" ? "size-3.5" : "size-4";
  const icon = Icon ? <Icon className={iconSize} aria-hidden="true" /> : null;

  if (props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      block: _b,
      icon: _i,
      children: _c,
      className: _cn,
      busy: _busy,
      busyLabel: _bl,
      disabled: _d,
      to: _to,
      ...anchor
    } = props;
    return (
      <a {...anchor} className={look}>
        {icon}
        {children}
      </a>
    );
  }

  if (props.to !== undefined) {
    const {
      variant: _v,
      size: _s,
      block: _b,
      icon: _i,
      children: _c,
      className: _cn,
      busy: _busy,
      busyLabel: _bl,
      disabled: _d,
      href: _h,
      ...link
    } = props;
    return (
      <Link {...link} className={look}>
        {icon}
        {children}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    block: _b,
    icon: _i,
    children: _c,
    className: _cn,
    busy = false,
    busyLabel,
    disabled,
    type = "button",
    to: _to,
    href: _href,
    ...button
  } = props;
  return (
    <button
      {...button}
      type={type}
      className={look}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import type { LinkProps } from "react-router";
import type { ButtonLook, ButtonSize } from "./buttonClass";

import { Link } from "react-router";
import { buttonClass } from "./buttonClass";

type Look = Pick<ButtonLook, "variant" | "size" | "shape" | "block"> & {
  /** Classes for the outer element (a margin, `grow`, `join-item`), never its look. */
  className?: string;
};

/** Text (with an optional leading icon), or an icon alone with a required `label`. */
type Content =
  | {
      /** A leading icon (decorative: the text names the button). */
      icon?: LucideIcon;
      children: ReactNode;
      label?: never;
    }
  | {
      icon: LucideIcon;
      /** Icon only: the accessible name and the tooltip. */
      label: string;
      children?: never;
    };

/** What only a `<button>` takes (never a link). */
type NotALink = {
  busy?: never;
  busyLabel?: never;
  disabled?: never;
  pressed?: never;
  expanded?: never;
  controls?: never;
  ref?: never;
  /** For data hooks (`data-*`) and an `aria-label` when the text needs more. */
  [attr: `data-${string}`]: string | undefined;
  "aria-label"?: string;
};

type AsButton = Look &
  Content &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children" | "style" | "type" | "aria-pressed" | "aria-expanded" | "aria-controls"
  > & {
    /** "button" by default; a form's Save passes "submit". */
    type?: "button" | "submit" | "reset";
    /** Working: the button is disabled and shows `busyLabel` (when given) instead of its text. */
    busy?: boolean;
    /** What it says while busy ("Saving…"). */
    busyLabel?: string;
    /** A toggle (`aria-pressed`): filled when on, outlined when off; it replaces the variant. */
    pressed?: boolean;
    /** A disclosure's state: what it shows is open (`aria-expanded`). */
    expanded?: boolean;
    /** The id of what it shows or hides (`aria-controls`). */
    controls?: string;
    ref?: Ref<HTMLButtonElement>;
    to?: never;
    href?: never;
  };

type AsLink = Look &
  Content &
  Pick<LinkProps, "to" | "replace" | "state" | "prefetch" | "preventScrollReset"> &
  NotALink & { href?: never };

type AsAnchor = Look &
  Content &
  NotALink & {
    /** A document navigation outside the router: another site, a `webcal:` link, a server route. */
    href: string;
    target?: "_blank";
    rel?: string;
    to?: never;
  };

export type ButtonProps = AsButton | AsLink | AsAnchor;

const TEXT_ICON: Record<ButtonSize, string> = { lg: "size-5", md: "size-4", sm: "size-4", xs: "size-3.5" };
const ONLY_ICON: Record<ButtonSize, string> = { lg: "size-6", md: "size-6", sm: "size-4", xs: "size-3.5" };

/**
 * The one button, in one of the kit's looks (`buttonClass`: `variant`, `size`,
 * `shape`, `block`). Text, an `icon` and text, or an `icon` alone with a
 * required `label` (its accessible name and tooltip; the box is `square`
 * unless a `shape` is given). With `to` it's a router link that looks the same
 * (and takes `replace`, `state`, `prefetch`, `preventScrollReset`); with `href`, a plain `<a>` for a
 * navigation the router doesn't own (another site, a `webcal:` link, a server
 * route such as an OAuth start). As a button: `busy` disables it and swaps its
 * text for `busyLabel`, so nothing is sent twice; `pressed` makes it a toggle;
 * `expanded` and `controls` a disclosure; `ref` reaches it, to return focus.
 * `IconButton` is a short name for the icon-only form.
 */
export function Button(props: ButtonProps) {
  const { variant, size = "md", shape, block, icon: Icon, label, children, className = "" } = props;
  const iconOnly = label !== undefined;
  const pressed = props.to === undefined && props.href === undefined ? props.pressed : undefined;
  const look =
    `${buttonClass({ variant, size, block, shape: shape ?? (iconOnly ? "square" : undefined), pressed })} ${className}`.trim();
  const icon = Icon ? <Icon className={(iconOnly ? ONLY_ICON : TEXT_ICON)[size]} aria-hidden="true" /> : null;
  const name = iconOnly ? { "aria-label": label, title: label } : {};

  if (props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      shape: _sh,
      block: _b,
      icon: _i,
      label: _l,
      children: _c,
      className: _cn,
      busy: _busy,
      busyLabel: _bl,
      disabled: _d,
      pressed: _p,
      expanded: _e,
      controls: _ct,
      ref: _r,
      to: _to,
      ...anchor
    } = props;
    return (
      <a {...anchor} {...name} className={look}>
        {icon}
        {children}
      </a>
    );
  }

  if (props.to !== undefined) {
    const {
      variant: _v,
      size: _s,
      shape: _sh,
      block: _b,
      icon: _i,
      label: _l,
      children: _c,
      className: _cn,
      busy: _busy,
      busyLabel: _bl,
      disabled: _d,
      pressed: _p,
      expanded: _e,
      controls: _ct,
      ref: _r,
      href: _h,
      ...link
    } = props;
    return (
      <Link {...link} {...name} className={look}>
        {icon}
        {children}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    shape: _sh,
    block: _b,
    icon: _i,
    label: _l,
    children: _c,
    className: _cn,
    busy = false,
    busyLabel,
    disabled,
    pressed: _p,
    expanded,
    controls,
    type = "button",
    to: _to,
    href: _href,
    ...button
  } = props;
  return (
    <button
      {...button}
      {...name}
      type={type}
      className={look}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
    >
      {icon}
      {busy && busyLabel && !iconOnly ? busyLabel : children}
    </button>
  );
}

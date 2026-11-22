// The one map from a button's look to its daisyUI classes (pure, unit-tested).
// `Button` uses it, and so do the kit's other button-shaped controls (the chip
// style, the tool circle, `IconButton`, a `Menu`'s trigger, the date field's
// buttons), so nobody writes `btn` strings by hand.

/**
 * - `primary`: the one main action of a form or screen.
 * - `secondary` (the default): a plain secondary action (Cancel).
 * - `ghost`: a quiet action with no box until hover.
 * - `danger`: solid red, only in a confirm dialog or a form whose one job is
 *   the destructive act.
 * - `dangerQuiet`: red text on a ghost button, for a destructive action
 *   anywhere else.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerQuiet";
export type ButtonSize = "lg" | "md" | "sm" | "xs";
/**
 * The box: `rounded` (the default, the theme's field radius), `pill` (fully
 * rounded ends), and for an icon-only button `square` or `round` (a circle).
 */
export type ButtonShape = "rounded" | "pill" | "square" | "round";

export type ButtonLook = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  shape?: ButtonShape;
  /**
   * A toggle's state, which replaces the variant: on is filled (neutral), off
   * an outlined ghost. Leave it out for a button that isn't a toggle.
   */
  pressed?: boolean;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "",
  ghost: "btn-ghost",
  danger: "btn-error",
  dangerQuiet: "btn-ghost text-error",
};

const SIZE: Record<ButtonSize, string> = { lg: "btn-lg", md: "", sm: "btn-sm", xs: "btn-xs" };

const SHAPE: Record<ButtonShape, string> = {
  rounded: "",
  pill: "rounded-full",
  square: "btn-square",
  round: "btn-circle",
};

const TOGGLE_ON = "btn-neutral";
const TOGGLE_OFF = "border-base-300 bg-base-100";

export const buttonClass = ({
  variant = "secondary",
  size = "md",
  block = false,
  shape = "rounded",
  pressed,
}: ButtonLook = {}) => {
  const tone = pressed === undefined ? variant : pressed ? "secondary" : "ghost";
  const toggle = pressed === undefined ? "" : pressed ? TOGGLE_ON : TOGGLE_OFF;
  return ["btn", VARIANT[tone], SIZE[size], block ? "btn-block" : "", SHAPE[shape], toggle]
    .filter(Boolean)
    .join(" ");
};

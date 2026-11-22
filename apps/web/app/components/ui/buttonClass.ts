// The one map from a button's look to its daisyUI classes (pure, unit-tested).
// `Button` uses it, and so do the kit's other button-shaped controls (the chip
// style, the tool circle, `IconButton`, the date field's buttons), so nobody
// writes `btn` strings by hand.

/**
 * - `primary`: the one main action of a form or screen.
 * - `default`: a plain secondary action (Cancel).
 * - `ghost`: a quiet action with no box until hover.
 * - `danger`: solid red, only in a confirm dialog or a form whose one job is
 *   the destructive act.
 * - `dangerQuiet`: red text on a ghost button, for a destructive action
 *   anywhere else.
 */
export type ButtonVariant = "primary" | "default" | "ghost" | "danger" | "dangerQuiet";
export type ButtonSize = "md" | "sm" | "xs";
/** An icon-only button's box: square or round. */
export type ButtonShape = "square" | "circle";

export type ButtonLook = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  shape?: ButtonShape;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  default: "",
  ghost: "btn-ghost",
  danger: "btn-error",
  dangerQuiet: "btn-ghost text-error",
};

const SIZE: Record<ButtonSize, string> = { md: "", sm: "btn-sm", xs: "btn-xs" };

const SHAPE: Record<ButtonShape, string> = { square: "btn-square", circle: "btn-circle" };

export const buttonClass = ({ variant = "default", size = "md", block = false, shape }: ButtonLook = {}) =>
  ["btn", VARIANT[variant], SIZE[size], block ? "btn-block" : "", shape ? SHAPE[shape] : ""]
    .filter(Boolean)
    .join(" ");

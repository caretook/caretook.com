// Class strings the primitives share, so menus, popovers and sheets look alike.
// Internal to ui/: callers never pass class strings.

/** A floating surface: menus and popovers (exported for quick entry's matching names). */
export const SURFACE = "rounded-box border-base-300 bg-base-100 border shadow-lg";

/** A field's label, and its help, error and warning lines (daisyUI `fieldset`). */
export const FIELD_LABEL = "fieldset-legend";
export const FIELD_HELP = "label text-base-content/70 whitespace-normal";
export const FIELD_ERROR = "text-error text-sm";
export const FIELD_WARNING = "text-warning text-sm";

/** A chip: a small rounded button or link; the current one is filled. */
export const chipClass = (current: boolean) =>
  `btn btn-sm rounded-full px-3 ${current ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100"}`;

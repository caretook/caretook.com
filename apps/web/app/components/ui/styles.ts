// Class strings the primitives share, so menus, popovers and sheets look alike.
// Internal to ui/: callers never pass class strings.

import { buttonClass } from "./buttonClass";

/** A floating surface: menus and popovers (exported for quick entry's matching names). */
export const SURFACE = "rounded-box border-base-300 bg-base-100 border shadow-lg";

/** A field's label, and its help, error and warning lines (daisyUI `fieldset`). */
export const FIELD_LABEL = "fieldset-legend";
export const FIELD_HELP = "label text-muted whitespace-normal";
export const FIELD_ERROR = "text-error text-sm";
export const FIELD_WARNING = "text-warning text-sm";

/** A chip: a small rounded button or link; the current one is filled. */
export const chipClass = (current: boolean) =>
  `${buttonClass({ variant: current ? "default" : "ghost", size: "sm" })} rounded-full px-3 ${current ? "btn-neutral" : "border-base-300 bg-base-100"}`;

/**
 * The list tools' one control shape: an outlined, icon-only circle (the
 * timeline's magnifier, Filter and View options; every list's Filter).
 * `CIRCLE` is the shape for an `IconButton` (which adds the `btn` part);
 * `TOOL_CIRCLE` the whole of it, for a control that isn't one (a menu's trigger).
 */
export const CIRCLE = "border-base-300 bg-base-100 shrink-0 rounded-full";
export const TOOL_CIRCLE = `${buttonClass({ variant: "ghost", size: "sm", shape: "square" })} ${CIRCLE}`;

// ui-kit (slice 4): the heading scale for /app (marketing, print and /admin keep
// their own), the one inline link style and the three icon sizes.
/** A page's title (the `h1`). */
export const TITLE_PAGE = "text-xl font-semibold";
/** A section's or card's title. */
export const TITLE_SECTION = "text-base font-semibold";
/** A sub-heading inside a section. */
export const TITLE_SUB = "text-sm font-semibold";
/** The one inline link style (the colour of `link-primary`, underlined, never a button). */
export const LINK = "link link-primary";
export const ICON_SM = "size-3.5";
export const ICON = "size-4";
export const ICON_LG = "size-5";

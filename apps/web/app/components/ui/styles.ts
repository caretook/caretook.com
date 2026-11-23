// Class strings the primitives share, so menus, popovers and sheets look alike.
// Internal to ui/: callers never pass class strings.

import { buttonClass } from "./buttonClass";

/** A floating surface: menus and popovers (exported for quick entry's matching names). */
export const SURFACE = "rounded-box border-base-300 bg-base-100 border shadow-lg";

/** A field's label, and its help, error and warning lines (daisyUI `fieldset`). */
export const FIELD_LABEL = "fieldset-legend";
export const FIELD_HELP = "label text-muted whitespace-normal";
export const FIELD_ERROR = "text-error-ink text-sm";
export const FIELD_WARNING = "text-warning-ink text-sm";

/** A chip: a small rounded button or link; the current one is filled. */
export const chipClass = (current: boolean) =>
  `${buttonClass({ variant: current ? "secondary" : "ghost", size: "sm" })} rounded-full px-3 ${current ? "btn-neutral" : "border-base-300 bg-base-100"}`;

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
/** The one inline link style (primary, lifted in dark to keep 4.5:1; underlined, never a button). */
export const LINK = "link text-primary-ink";
export const ICON_SM = "size-3.5";
export const ICON = "size-4";
export const ICON_LG = "size-5";
// ui-kit-5 (slice 1): the count on a filter button, at its corner.
export const COUNT_BADGE = "badge badge-neutral badge-xs absolute -top-1 -right-1 min-w-4 px-1 font-semibold";
// ui-kit-5 (slice 2): a native radio that looks like a button, joined in a row (`ChoiceGroup`, the
// entry kind picker), and a radio's label as a tall outlined tile (the feelings scale).
export const CHOICE_BUTTON = `join-item ${buttonClass({ size: "sm" })}`;
export const CHOICE_TILE = `${buttonClass()} btn-outline has-checked:btn-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2`;
// ui-kit-5 (slice 7): a link in a navigation bar, which is not a `Button` (the header's sections).
export const navLinkClass = (current: boolean) =>
  `${buttonClass({ variant: "ghost", size: "sm" })} gap-1.5 ${current ? "btn-active" : ""}`.trim();

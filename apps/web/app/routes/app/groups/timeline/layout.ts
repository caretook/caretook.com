/**
 * The timeline's widths and the header strips' shared look. Below `lg` both
 * caps are moot (the page is `max-w-2xl`); from `lg` the page spans the window.
 */

/** The entries' column, the quick-add bar and the filter chips: 1024 px, centred on the page. */
export const COLUMN_CAP = "mx-auto max-w-5xl";

/** A row's right-hand column: the ⋯ menu with the author under it (rows and pass logs, so the chips line up). */
export const ASIDE_CLASS = "flex shrink-0 flex-col items-center gap-1";

/**
 * The header strips (vitals, Next, Live now, Due now): 1152 px from `lg`,
 * centred. That's 64 px wider than the entries' column on each side, so the
 * strips frame it, yet narrower than the page from 1280 wide (1248 px inside
 * its gutters), so they never run edge to edge on a large screen.
 */
export const STRIP_CAP = "lg:mx-auto lg:max-w-6xl";

/**
 * One line of the strip family (the vitals line and the Next strip): a
 * 32 px bordered box with a 16 px icon, small text and `btn-xs` actions.
 */
export const STRIP_CLASS = `rounded-box border-base-300 bg-base-100 flex min-h-8 items-center gap-2 border px-2.5 text-sm ${STRIP_CAP}`;

/** A strip's leading icon. */
export const STRIP_ICON = "size-4 shrink-0";

/** A strip's action button at its end. */
export const STRIP_ACTION = "btn btn-ghost btn-xs text-base-content/70 shrink-0";

/**
 * A header tile showing what it remembered from earlier this session (the
 * tile cache), until its live query confirms: dimmed, beside `data-stale`.
 */
export const STALE = "opacity-60";

/**
 * A strip's place while nothing is known yet (a first visit this session):
 * the strip's own 32 px, so nothing below moves when it arrives.
 */
export const STRIP_SKELETON = `skeleton rounded-box h-8 ${STRIP_CAP}`;

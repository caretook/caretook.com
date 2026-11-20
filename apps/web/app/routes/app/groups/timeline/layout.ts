/**
 * The timeline's widths and the header's shared look. Below `lg` both caps
 * are moot (the page is `max-w-2xl`); from `lg` the page spans the window.
 */

/** The entries' column, the quick-add bar and the filter chips: 1024 px, centred on the page. */
export const COLUMN_CAP = "mx-auto max-w-5xl";

/**
 * The header's boxes (the Today card, Live now): 1152 px from `lg`, centred.
 * That's 64 px wider than the entries' column on each side, so they frame
 * it, yet narrower than the page from 1280 wide (1248 px inside its
 * gutters), so they never run edge to edge on a large screen.
 */
export const STRIP_CAP = "lg:mx-auto lg:max-w-6xl";

/**
 * A header tile showing what it remembered from earlier this session (the
 * tile cache), until its live query confirms: dimmed, beside `data-stale`.
 */
export const STALE = "opacity-60";

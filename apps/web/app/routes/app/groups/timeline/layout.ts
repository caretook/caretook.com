/**
 * The timeline's widths and the header's shared look. Below `lg` both caps
 * are moot (the page is `max-w-2xl`); from `lg` the page spans the window.
 */

/** The entries' column, the header, the Today card, Live now, the quick-add bar and the filter chips: 1024 px, centred on the page. */
export const COLUMN_CAP = "mx-auto max-w-5xl";

/** The box an entry list (and an empty Today) sits in: bordered, rounded, lightly raised. */
export const ROWS_BOX = "rounded-box border-base-300 bg-base-100 overflow-hidden border shadow-sm";

/**
 * A header tile showing what it remembered from earlier this session (the
 * tile cache), until its live query confirms: dimmed, beside `data-stale`.
 */
export const STALE = "opacity-60";

/** One of easy mode's blocks (Upcoming, My todos, the tiles, quick entry): a card on the page, so each reads apart. */
export const EASY_BLOCK = "rounded-box border-base-300 bg-base-100 border p-4 shadow-sm";

/** A easy block's heading, with its small icon before the words. */
export const EASY_HEADING = "flex items-center gap-2 text-lg font-semibold";

import type { TimelineView } from "@caretook/data/schema";

import { PAGE_SIZE } from "../../../../lib/core/paging";

// Off-screen rows cost little (B-139): a day's rows skip their rendering
// while they're off screen (`content-visibility: auto`), so a long timeline's
// layouts and style passes only touch what's near the screen. Rows stay in
// the DOM and the accessibility tree. Every row carries `contain-intrinsic-
// size: auto <estimate>`, so it remembers its rendered size from the first
// time it's drawn, and a skipped row keeps the height it had: the page's
// height and the scroll position hold.
//
// The end of the list stays uncontained: the days holding the newest page
// loaded (the last `PAGE_SIZE` rows, by the paging sentinel), so a jump to
// the end never meets rows sized by the estimate, and they're drawn (and
// their sizes remembered) before a later page contains them. The day
// headers, the sentinel and the list's own box are never contained.

/** On every row: its remembered size, else the estimate (a row's or a card's usual height). */
export const ROW_SIZE: Record<TimelineView, string> = {
  rows: "[&>li]:[contain-intrinsic-size:auto_70px]",
  cards: "[&>li]:[contain-intrinsic-size:auto_100px]",
};

/** On a settled day's list: its rows skip rendering while off screen. */
export const OFFSCREEN_ROWS = "[&>li]:[content-visibility:auto]";

/**
 * The days whose rows may skip rendering: every day before the last
 * `tail` rows (counted from the end, markers included). A day holding any of
 * them stays drawn.
 */
export function settledDays(days: readonly { key: string; entries: readonly unknown[] }[], tail = PAGE_SIZE) {
  const settled = new Set<string>();
  let after = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!;
    if (after >= tail) settled.add(day.key);
    after += day.entries.length;
  }
  return settled;
}

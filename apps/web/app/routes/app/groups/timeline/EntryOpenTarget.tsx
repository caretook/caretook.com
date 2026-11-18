import type { EntryOpen } from "./entryOpen";
import type { TimelineEntry } from "~/lib/rpc";

import { Link } from "react-router";
import { openLabel } from "./entryLabels";
import { SHEET_LINK_STATE } from "./sheet";

/**
 * The whole row's tap target: a link stretched over the row or card, so it's
 * one focusable, named control for keyboards and screen readers. The kind
 * icon, the ⋯ button and the More/Less toggle sit above it (`relative z-10`),
 * so taps on them don't open the entry. The row itself must be `relative
 * isolate` (its own stacking context, so those don't rise above the sticky
 * day headers). An edit sheet's link keeps the scroll position and marks
 * that it was opened from the timeline.
 */
export function EntryOpenTarget({ open, entry }: { open: EntryOpen; entry: TimelineEntry }) {
  return (
    <Link
      to={open.to}
      state={open.sheet ? SHEET_LINK_STATE : undefined}
      preventScrollReset={open.sheet}
      className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
      aria-label={openLabel(entry, open.sheet)}
    />
  );
}

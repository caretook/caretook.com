import type { RefObject } from "react";
import type { TimelineData } from "./useTimelineData";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "~/components/ui";
import { LANDING_GAP } from "./useJumpLanding";

const NOTICE = "[data-jump-notice]";

/**
 * What to hold still: the first row on screen, else the jump's notice, with
 * where it is on screen (`top`) and the scroll then (`y`), so scrolling on
 * while the rows load is the reader's, not undone when they're in.
 */
const anchorIn = (list: HTMLElement | null) => {
  if (!list) return null;
  const rows = [...list.querySelectorAll("ol > li")];
  const el = rows.find((row) => row.getBoundingClientRect().bottom > 0) ?? list.querySelector(NOTICE);
  return el ? { el, top: el.getBoundingClientRect().top, y: window.scrollY } : null;
};

/**
 * The top of a jump's window: loads newer days as you scroll up (or with its
 * button, where the page is too short to scroll), and on its own when nothing
 * is on or before the day. `armed` waits for the landing scroll. The page is
 * held by measurement, since iOS Safari has no reliable scroll anchoring: the
 * row on screen is measured before a load and moved back by what the new
 * rows pushed it, keeping any scrolling done while they loaded.
 */
export function NewerEntries({
  newer,
  armed,
  empty,
  list,
}: {
  newer: TimelineData["newer"];
  armed: boolean;
  /** The window has no rows: the oldest day is loaded without asking. */
  empty: boolean;
  list: RefObject<HTMLElement | null>;
}) {
  const top = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof anchorIn>>(null);
  const load = useRef(() => {});
  useEffect(() => {
    load.current = () => {
      if (newer.loading || !newer.has) return;
      // A scroll before the first load's render calls again: the first measure stands.
      hold.current ??= anchorIn(list.current);
      newer.load();
    };
  });

  useEffect(() => {
    if (!armed || !empty || !newer.has || newer.loading) return;
    load.current();
    // The page was too short to land on the notice: once the oldest day is under it, it goes to the top.
    if (hold.current) hold.current.top = LANDING_GAP;
  }, [armed, empty, newer.has, newer.loading]);

  // Only a scroll upward loads: landing on the day leaves the rows above it unread.
  useEffect(() => {
    if (!armed || !newer.has) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const up = y < last;
      last = y;
      const edge = top.current?.getBoundingClientRect().top;
      if (up && edge !== undefined && edge > -window.innerHeight) load.current();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [armed, newer.has]);

  // Once the new rows are in, before paint: put the row back where it was, less the scrolling since.
  useLayoutEffect(() => {
    if (newer.loading || !hold.current) return;
    const { el, top: was, y } = hold.current;
    hold.current = null;
    const target = el.isConnected ? el : list.current?.querySelector(NOTICE);
    if (!target) return;
    const moved = target.getBoundingClientRect().top - (was - (window.scrollY - y));
    if (moved) window.scrollBy({ top: moved, behavior: "instant" });
  });

  if (!newer.has) return null;
  return (
    <div ref={top} data-newer-entries="" className="flex flex-col items-center print:hidden">
      <p role="status" aria-live="polite" className="text-muted text-center text-sm empty:hidden">
        {newer.loading ? "Loading newer…" : ""}
      </p>
      {!newer.loading && (
        <Button variant="ghost" size="sm" onClick={() => load.current()} data-load-newer="">
          Show newer entries
        </Button>
      )}
    </div>
  );
}

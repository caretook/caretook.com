import { useEffect, useRef } from "react";
import { endOfListText } from "~/lib/paging";

/**
 * The end of a growing list (the timeline, Upcoming's Past tab): a sentinel that loads the next page when it comes
 * within about a screen of the viewport, and one polite status that says
 * "Loading older…" while a page loads and "That's the beginning of the
 * timeline" once there's nothing older (shown, too). It sits after the last
 * day's section, never inside a day's list.
 */
export function OlderEntries({
  hasOlder,
  loading,
  empty,
  onLoadOlder,
  endText,
}: {
  hasOlder: boolean;
  loading: boolean;
  /** The timeline shows its empty state instead (no end message). */
  empty: boolean;
  onLoadOlder: () => void;
  /** What it says once there's nothing older (default: the timeline's). */
  endText?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  // The latest callback, so the observer isn't rebuilt for a new function each render.
  const load = useRef(onLoadOlder);
  useEffect(() => {
    load.current = onLoadOlder;
  });

  // Rebuilt after each page (`loading` flips back), so a sentinel still in
  // range after a page lands reports again and the next page loads.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasOlder || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) load.current();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOlder, loading]);

  const text = endOfListText({ empty, loading, hasOlder, endText });
  return (
    <div data-older-entries>
      {hasOlder && <div ref={sentinel} aria-hidden="true" className="h-px" data-older-sentinel />}
      <p
        role="status"
        aria-live="polite"
        className="text-base-content/70 py-2 text-center text-sm empty:py-0"
      >
        {text}
      </p>
    </div>
  );
}

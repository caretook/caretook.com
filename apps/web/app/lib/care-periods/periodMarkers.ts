import type { PeriodSpan, TrackPeriod } from "@caretook/data/schema";

// The timeline's boundary markers: one "From → to" row where each care
// period starts, drawn from the track (never written as entries). This
// module decides which markers fall in the timeline's loaded window; the
// list places them in their day sections (`withMarkers` beside the
// timeline). Pure, so web:unit tests it. Markers ignore the kind and author
// filters: they're context, not entries.

/** A marker: where a period starts, the period before it (null for the first) and the one it starts. */
export type PeriodMarker<P extends TrackPeriod = TrackPeriod> = {
  /** The started period's id (one marker per period). */
  id: string;
  /** ISO 8601: the period's start. */
  at: string;
  from: P | null;
  to: P;
};

const ms = (iso: string) => new Date(iso).getTime();

/**
 * The markers to show, newest first (a later period first when two start
 * together). The timeline shows entries back to `oldestLoaded` (the oldest
 * loaded entry's time, null when none is loaded); a marker at or after it is
 * in the window. While `hasOlder`, older markers wait for their page, so
 * scrolling back never shows one out of place; once the timeline has reached
 * its beginning (or has no entries at all), every older marker shows too.
 * Under a filter that matches nothing (`filtered`, nothing loaded) there are
 * none: the list is its empty state alone. `before` is a jump's upper bound:
 * nothing at or after it shows.
 */
export const periodMarkers = <P extends TrackPeriod>(
  spans: readonly PeriodSpan<P>[],
  {
    oldestLoaded,
    hasOlder,
    filtered = false,
    before = null,
  }: { oldestLoaded: string | null; hasOlder: boolean; filtered?: boolean; before?: string | null },
): PeriodMarker<P>[] => {
  const markers = spans.map((span, i) => ({
    id: span.period.id,
    at: span.startsAt,
    from: spans[i - 1]?.period ?? null,
    to: span.period,
  }));
  const shown =
    oldestLoaded === null
      ? hasOlder || filtered
        ? []
        : markers
      : hasOlder
        ? markers.filter((m) => ms(m.at) >= ms(oldestLoaded))
        : markers;
  return (before ? shown.filter((m) => ms(m.at) < ms(before)) : shown).reverse();
};

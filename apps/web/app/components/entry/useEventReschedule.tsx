import type { TimelineEntry } from "~/lib/core/rpc";

import { lazy, Suspense, useEffect, useState } from "react";

/** What the reschedule sheet reads from an event. */
export type RescheduleTarget = Pick<
  TimelineEntry,
  "id" | "kind" | "title" | "occurredAt" | "endsAt" | "allDay" | "timeZone" | "cancelledAt"
>;

// The sheet uses the date picker, which the timeline and Upcoming otherwise
// don't load: it comes in its own chunk, fetched as soon as a writer's list
// mounts, so Reschedule still opens offline.
const loadSheet = () => import("~/components/schedule");
const LazySheet = lazy(() => loadSheet().then((m) => ({ default: m.RescheduleSheet })));

/**
 * Rescheduling events from a screen (the timeline, Upcoming, the entry
 * page): `ask` opens the sheet for an event, and `sheet` is where it renders
 * (nothing while closed). `enabled` (writers) fetches the sheet's code at once.
 */
export function useEventReschedule(groupId: string, enabled: boolean) {
  const [asking, setAsking] = useState<RescheduleTarget | null>(null);
  useEffect(() => {
    if (enabled) void loadSheet().catch(() => undefined);
  }, [enabled]);
  return {
    ask: (entry: RescheduleTarget) => setAsking(entry),
    sheet: asking && (
      <Suspense fallback={null}>
        <LazySheet key={asking.id} entry={asking} groupId={groupId} onClose={() => setAsking(null)} />
      </Suspense>
    ),
  };
}

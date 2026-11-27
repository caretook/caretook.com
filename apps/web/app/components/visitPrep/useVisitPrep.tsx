import { lazy, Suspense, useEffect, useState } from "react";

/** The appointment being prepared. */
export type VisitPrepTarget = { id: string; title: string | null };

// The sheet uses the date picker, which Upcoming and the provider page
// otherwise don't load: it comes in its own chunk, fetched as soon as a
// writer's screen mounts, so Prepare still opens offline.
const loadSheet = () => import("./VisitPrepSheet");
const LazySheet = lazy(() => loadSheet().then((m) => ({ default: m.VisitPrepSheet })));

/**
 * Preparing for a visit from a screen: `ask` opens the sheet for an
 * appointment, and `sheet` is where it renders (nothing while closed).
 * `enabled` (writers) fetches the sheet's code at once. `openAfter` goes to
 * the appointment's page once the section is in (from Upcoming and a
 * provider's page; the entry page is already there), with `openState` as
 * its history state: the screen's opener, so its Back returns there (B-936).
 */
export function useVisitPrep(
  groupId: string,
  enabled: boolean,
  { openAfter = false, openState }: { openAfter?: boolean; openState?: object } = {},
) {
  const [asking, setAsking] = useState<VisitPrepTarget | null>(null);
  useEffect(() => {
    if (enabled) void loadSheet().catch(() => undefined);
  }, [enabled]);
  return {
    ask: (target: VisitPrepTarget) => setAsking(target),
    sheet: asking && (
      <Suspense fallback={null}>
        <LazySheet
          key={asking.id}
          target={asking}
          groupId={groupId}
          openAfter={openAfter}
          openState={openState}
          onClose={() => setAsking(null)}
        />
      </Suspense>
    ),
  };
}

import type { PlanSeries, SeriesEditChange } from "@caretook/data/series";
import type { SeriesEditResult } from "~/lib/appointments/series.sync";
import type { ScopedEntry, SeriesAction } from "~/lib/appointments/seriesScope";

import { lazy, Suspense, useEffect, useState } from "react";
import { applySeriesEdit, fullSeriesQuery, toPlanSeries } from "~/lib/appointments/series.sync";
import { asksScope } from "~/lib/appointments/seriesScope";
import { getSync } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { CancelEventDialog } from "./CancelEventDialog";
import { SeriesScopeDialog } from "./SeriesScopeDialog";

// The sheet has the repeat field, whose preview needs rrule: its own chunk,
// fetched as soon as a writer's screen mounts, so it still opens offline.
const loadSheet = () => import("~/components/repeat");
const LazySheet = lazy(() => loadSheet().then((m) => ({ default: m.SeriesEditSheet })));

type Visit = ScopedEntry & { id: string; seriesDay?: string | null };

export type ScopeAsk = {
  /** "Only this visit" (or any change to a one-off or a past visit): the screen's own write. */
  only: () => void;
  /** "Only this visit" chosen in the dialog, when it differs (Delete: the dialog was the confirm). */
  onlyChosen?: () => void;
  /** "This and later visits", when it isn't the default (the series sheet, or the series write). */
  later?: () => void;
  /** Cancel or Escape. */
  dismissed?: () => void;
  /** After a "This and later" write lands. */
  done?: (res: Extract<SeriesEditResult, { ok: true }>) => void;
};

/**
 * "Only this visit" or "This and later visits" before a change to a series
 * visit (appointments-2), on any screen with entries' ⋯ menus. `ask` runs
 * `only` at once for a one-off or a visit that has started, and otherwise
 * opens `SeriesScopeDialog`. This and later: Delete ends the series here,
 * Cancel asks a reason and ends it, and Edit and Reschedule open the series
 * sheet. `element` is where the dialogs render; `error` is the last
 * refusal's message. `enabled` (writers) fetches the sheet's code at once.
 */
export function useSeriesScope(enabled: boolean) {
  const [asking, setAsking] = useState<{ entry: Visit; action: SeriesAction; ask: ScopeAsk } | null>(null);
  const [cancelling, setCancelling] = useState<{ entry: Visit; ask: ScopeAsk } | null>(null);
  const [editing, setEditing] = useState<{
    series: PlanSeries;
    entry: Visit;
    ask: ScopeAsk;
    error: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (enabled) void loadSheet().catch(() => undefined);
  }, [enabled]);

  const run = async (entry: Visit, change: SeriesEditChange, ask: ScopeAsk) => {
    const res = await applySeriesEdit(getSync(), { visitId: entry.id, scope: "later", change });
    setError(res.ok ? null : res.error);
    if (res.ok) ask.done?.(res);
    return res;
  };

  const openSheet = async (entry: Visit, ask: ScopeAsk) => {
    const [row] = await readRows<Parameters<typeof toPlanSeries>[0]>(
      getSync(),
      fullSeriesQuery(entry.seriesId ?? null),
    );
    const series = row ? toPlanSeries(row) : null;
    if (!series || !entry.seriesDay) return setError("This visit's series hasn't synced yet");
    setError(null);
    setEditing({ series, entry, ask, error: null });
  };

  const choose = (scope: "only" | "later") => {
    const current = asking;
    setAsking(null);
    if (!current) return;
    const { entry, action, ask } = current;
    if (scope === "only") return (ask.onlyChosen ?? ask.only)();
    if (ask.later) return ask.later();
    if (action === "delete") return void run(entry, { action: "delete" }, ask);
    if (action === "cancel") return setCancelling({ entry, ask });
    void openSheet(entry, ask);
  };

  return {
    ask: (entry: Visit, action: SeriesAction, ask: ScopeAsk) => {
      if (!asksScope(entry, new Date())) return ask.only();
      setAsking({ entry, action, ask });
    },
    /** Runs "This and later" with this change (an edit made on the entry page). */
    later: (entry: Visit, change: SeriesEditChange, ask: ScopeAsk) => run(entry, change, ask),
    error,
    element: (
      <>
        <SeriesScopeDialog
          open={!!asking}
          action={asking?.action ?? "edit"}
          onChoose={choose}
          onClose={() => {
            const current = asking;
            setAsking(null);
            current?.ask.dismissed?.();
          }}
        />
        <CancelEventDialog
          open={!!cancelling}
          onConfirm={(reason) => {
            const current = cancelling;
            setCancelling(null);
            if (current) void run(current.entry, { action: "cancel", reason }, current.ask);
          }}
          onClose={() => setCancelling(null)}
        />
        {editing && (
          <Suspense fallback={null}>
            <LazySheet
              key={editing.entry.id}
              series={editing.series}
              fromDay={editing.entry.seriesDay!}
              error={editing.error}
              onClose={() => setEditing(null)}
              onSave={(change) => {
                const current = editing;
                void run(current.entry, change, current.ask).then((res) =>
                  res.ok ? setEditing(null) : setEditing({ ...current, error: res.error }),
                );
              }}
            />
          </Suspense>
        )}
      </>
    ),
  };
}

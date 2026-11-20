import type { QuickEntryPass } from "@caretook/data/schema";
import type { CompletionName } from "~/lib/assistant/quickEntryCompletion";
import type { PredictionRow } from "~/lib/assistant/quickEntrySuggestions.sync";

import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { completeName } from "~/lib/assistant/quickEntryCompletion";
import { USUAL_DAYS, usualAtHour } from "~/lib/assistant/quickEntryPredictions";
import { useRecentLines } from "~/lib/assistant/recentLines";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { predictionEntriesQuery, toPredictionEntries } from "~/lib/assistant/quickEntrySuggestions.sync";
import { addDays, dayInZone, startOfDay } from "~/lib/core/zonedDay";
import { useQuickEntryData } from "./useQuickEntryData";

/** "Around now" moves on with the clock: recheck every few minutes. */
const USUAL_TICK_MS = 5 * 60_000;

const NO_ROWS: PredictionRow[] = [];
const NO_PASSES: QuickEntryPass[] = [];

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Quick entry's suggestions for what's typed so far, all from this device
 * (so they work offline): the medication, pass and provider names the last word
 * starts, what the group usually logs around now (`usualAtHour`, in the
 * recipient's zone), and your own recent lines in this group.
 */
export function useQuickEntrySuggestions({
  groupId,
  text,
  passes = NO_PASSES,
}: {
  groupId: string;
  text: string;
  /** The group's passes (the box reads them), for their names. */
  passes?: readonly QuickEntryPass[];
}) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone ?? deviceZone();
  const now = useNow(USUAL_TICK_MS);

  // From the start of the day before the first day looked at (a window can
  // start before its day does), so the query only changes once a day.
  const today = dayInZone(new Date(now), timeZone);
  const since = startOfDay(addDays(today, -(USUAL_DAYS + 1)), timeZone).toISOString();
  const query = predictionEntriesQuery(groupId, since);
  const rows = useLiveQuery<PredictionRow>(query.sql, query.params, NO_ROWS);
  const usual = useMemo(
    () => usualAtHour(toPredictionEntries(rows), new Date(now), timeZone),
    [rows, now, timeZone],
  );

  const recent = useRecentLines(group.userId, groupId);

  const { medications, providers } = useQuickEntryData(groupId);
  const names = useMemo<CompletionName[]>(
    () => [
      ...medications.map((m) => ({ id: m.id, name: m.name, kind: "medication" as const })),
      ...passes.map((p) => ({ id: p.id, name: p.name, kind: "pass" as const })),
      ...providers.map((p) => ({ id: p.id, name: p.name, kind: "provider" as const })),
    ],
    [medications, passes, providers],
  );
  const completions = useMemo(() => completeName(text, names), [text, names]);

  return { usual, recent, completions };
}

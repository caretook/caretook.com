import type { CompletionName } from "~/lib/quickEntryCompletion";
import type { PredictionRow } from "~/lib/sync/quickEntrySuggestions";

import { useMemo } from "react";
import { useGroup } from "~/lib/group";
import { completeName } from "~/lib/quickEntryCompletion";
import { USUAL_DAYS, usualAtHour } from "~/lib/quickEntryPredictions";
import { useRecentLines } from "~/lib/recentLines";
import { useLiveQuery } from "~/lib/sync";
import { useNow } from "~/lib/sync/editors";
import { predictionEntriesQuery, toPredictionEntries } from "~/lib/sync/quickEntrySuggestions";
import { addDays, dayInZone, startOfDay } from "~/lib/zonedDay";
import { useQuickEntryData } from "./useQuickEntryData";

/** "Around now" moves on with the clock: recheck every few minutes. */
const USUAL_TICK_MS = 5 * 60_000;

const NO_ROWS: PredictionRow[] = [];

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Quick entry's suggestions for what's typed so far, all from this device
 * (so they work offline): the medication and provider names the last word
 * starts, what the group usually logs around now (`usualAtHour`, in the
 * recipient's zone), and your own recent lines in this group.
 */
export function useQuickEntrySuggestions({ groupId, text }: { groupId: string; text: string }) {
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
      ...providers.map((p) => ({ id: p.id, name: p.name, kind: "provider" as const })),
    ],
    [medications, providers],
  );
  const completions = useMemo(() => completeName(text, names), [text, names]);

  return { usual, recent, completions };
}

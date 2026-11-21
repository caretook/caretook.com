import type { DaySummaryMode, TimelineView } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";

import { RecipientCard } from "./RecipientCard";
import { TimelineViewMenu } from "./TimelineViewMenu";

/**
 * The care recipient's card (their name, the group's, and a link to their
 * profile), then one "View options" menu (`TimelineViewMenu`: the layout, the
 * day summaries and simple mode). The + menu is on each day's heading
 * (`DayHeader`).
 */
export function TimelineHeader({
  view,
  onViewChange,
  summaryMode,
  onSummaryModeChange,
  simpleMode,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
  summaryMode: DaySummaryMode;
  onSummaryModeChange: (mode: DaySummaryMode) => void;
  simpleMode?: SimpleModeState;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <RecipientCard />
      <div className="flex shrink-0 items-center">
        <TimelineViewMenu
          view={view}
          onViewChange={onViewChange}
          summaryMode={summaryMode}
          onSummaryModeChange={onSummaryModeChange}
          simpleMode={simpleMode}
        />
      </div>
    </header>
  );
}

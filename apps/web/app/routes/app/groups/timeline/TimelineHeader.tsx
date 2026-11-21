import type { DaySummaryMode, TimelineView } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";

import { PageHeader } from "~/components/ui";
import { TimelineViewMenu } from "./TimelineViewMenu";

/**
 * The full timeline's "Timeline" heading, like the other sections (no
 * recipient card: the profile is in the group menu), then one "View options"
 * menu (`TimelineViewMenu`: the layout, the day summaries and simple mode).
 * The + menu is on each day's heading (`DayHeader`).
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
    <PageHeader
      title="Timeline"
      actions={
        <TimelineViewMenu
          view={view}
          onViewChange={onViewChange}
          summaryMode={summaryMode}
          onSummaryModeChange={onSummaryModeChange}
          simpleMode={simpleMode}
        />
      }
    />
  );
}

import type { ReactNode } from "react";
import type { DaySummaryMode, TimelineView } from "@caretook/data/schema";

import { useGroup } from "~/lib/group";
import { DaySummaryMenu } from "./DaySummaryMenu";
import { QuickAddMenu } from "./QuickAddMenu";
import { RecipientCard } from "./RecipientCard";
import { ViewToggle } from "./TimelineFilters";

/**
 * The care recipient's card (their name, the group's, and a link to their
 * profile), then the + menu (writers only), the rows/cards switch, the day
 * summaries menu (off, highlights or full) and the switch to simple mode
 * (`simpleToggle`).
 */
export function TimelineHeader({
  view,
  onViewChange,
  summaryMode,
  onSummaryModeChange,
  simpleToggle,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
  summaryMode: DaySummaryMode;
  onSummaryModeChange: (mode: DaySummaryMode) => void;
  simpleToggle?: ReactNode;
}) {
  const { id, canWrite } = useGroup();
  return (
    <header className="flex items-start justify-between gap-3">
      <RecipientCard />
      <div className="flex shrink-0 items-center gap-2">
        {canWrite && <QuickAddMenu groupId={id} />}
        <ViewToggle view={view} onChange={onViewChange} />
        <DaySummaryMenu mode={summaryMode} onChange={onSummaryModeChange} />
        {simpleToggle}
      </div>
    </header>
  );
}

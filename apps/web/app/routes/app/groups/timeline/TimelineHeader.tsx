import type { ReactNode } from "react";
import type { TimelineView } from "@caretook/data/schema";

import { RecipientCard } from "./RecipientCard";
import { ViewToggle } from "./TimelineFilters";

/**
 * The care recipient's card (their name, the group's, and a link to their
 * profile), then the rows/cards switch and the switch to simple mode
 * (`simpleToggle`). The + menu is on each day's heading (`DayHeader`).
 */
export function TimelineHeader({
  view,
  onViewChange,
  simpleToggle,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
  simpleToggle?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <RecipientCard />
      <div className="flex shrink-0 items-center gap-2">
        <ViewToggle view={view} onChange={onViewChange} />
        {simpleToggle}
      </div>
    </header>
  );
}

import type { TimelineView } from "@caretook/data/schema";

import { RecipientCard } from "./RecipientCard";
import { ViewToggle } from "./TimelineFilters";

/** The care recipient's card (their name, the group's, and a link to their profile), and the rows/cards switch. */
export function TimelineHeader({
  view,
  onViewChange,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <RecipientCard />
      <ViewToggle view={view} onChange={onViewChange} />
    </header>
  );
}

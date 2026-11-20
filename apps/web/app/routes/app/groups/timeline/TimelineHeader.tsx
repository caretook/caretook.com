import type { ReactNode } from "react";
import type { TimelineView } from "@caretook/data/schema";

import { useGroup } from "~/lib/group";
import { QuickAddMenu } from "./QuickAddMenu";
import { RecipientCard } from "./RecipientCard";
import { ViewToggle } from "./TimelineFilters";

/**
 * The care recipient's card (their name, the group's, and a link to their
 * profile), then the + menu (writers only), the rows/cards switch and the
 * switch to simple mode (`simpleToggle`).
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
  const { id, canWrite } = useGroup();
  return (
    <header className="flex items-start justify-between gap-3">
      <RecipientCard />
      <div className="flex shrink-0 items-center gap-2">
        {canWrite && <QuickAddMenu groupId={id} />}
        <ViewToggle view={view} onChange={onViewChange} />
        {simpleToggle}
      </div>
    </header>
  );
}

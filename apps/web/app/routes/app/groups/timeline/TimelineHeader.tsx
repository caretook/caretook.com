import type { TimelineView } from "@caretook/data/schema";

import { useGroup } from "~/lib/group";
import { ViewToggle } from "./TimelineFilters";

/** The care recipient's name, the group's (and whether you can only view), and the rows/cards switch. */
export function TimelineHeader({
  view,
  onViewChange,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
}) {
  const group = useGroup();
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold">{group.displayName}</h1>
        <p className="text-base-content/70 text-sm">
          {group.name}
          {group.role === "viewer" && " · You can view this timeline"}
        </p>
      </div>
      <ViewToggle view={view} onChange={onViewChange} />
    </header>
  );
}

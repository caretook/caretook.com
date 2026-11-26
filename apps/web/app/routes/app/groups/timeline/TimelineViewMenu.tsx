import type { DaySummaryMode, TimelineView } from "@caretook/data/schema";

import { Eye } from "lucide-react";
import { layoutSection } from "~/components/settings";
import { CIRCLE, ICON, Menu } from "~/components/ui";

const MODE_ITEMS: { id: DaySummaryMode; label: string; description: string }[] = [
  { id: "highlights", label: "Highlights", description: "What stands out" },
  { id: "full", label: "Full", description: "Everything logged" },
  { id: "off", label: "Off", description: "No summaries" },
];

const isMode = (id: string): id is DaySummaryMode => MODE_ITEMS.some((m) => m.id === id);

/**
 * The full timeline's "View options" (an eye icon), at the right end of the
 * filter row (`FilterChips`' `trailing`, the row's circle), at every width: Layout (Condensed or Full, one choice:
 * the shared `layoutSection`, which the providers list uses too) and Day summaries (Highlights,
 * Full or Off, the viewer's setting: `useDaySummaryMode`). Easy mode's
 * toggle is the page header's button (`EasyModeToggle`), not here.
 */
export function TimelineViewMenu({
  view,
  onViewChange,
  summaryMode,
  onSummaryModeChange,
}: {
  view: TimelineView;
  onViewChange: (view: TimelineView) => void;
  summaryMode: DaySummaryMode;
  onSummaryModeChange: (mode: DaySummaryMode) => void;
}) {
  return (
    <Menu
      label="View options"
      variant="ghost"
      size="sm"
      shape="square"
      className={CIRCLE}
      width="md"
      items={[
        layoutSection(view, onViewChange),
        {
          type: "section",
          id: "day-summaries",
          title: "Day summaries",
          items: MODE_ITEMS,
          selection: { selected: summaryMode, onChange: (id) => isMode(id) && onSummaryModeChange(id) },
        },
      ]}
    >
      <Eye className={ICON} aria-hidden="true" />
    </Menu>
  );
}

import type { DaySummaryMode, TimelineView } from "@caretook/data/schema";
import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";

import { LayoutList, List, SlidersHorizontal, Type } from "lucide-react";
import { Menu, SEPARATOR } from "~/components/ui";

const VIEW_ITEMS: { id: TimelineView; label: string; icon: typeof List }[] = [
  { id: "rows", label: "Rows", icon: List },
  { id: "cards", label: "Cards", icon: LayoutList },
];

const MODE_ITEMS: { id: DaySummaryMode; label: string; description: string }[] = [
  { id: "highlights", label: "Highlights", description: "What stands out" },
  { id: "full", label: "Full", description: "Everything logged" },
  { id: "off", label: "Off", description: "No summaries" },
];

const isView = (id: string): id is TimelineView => VIEW_ITEMS.some((v) => v.id === id);
const isMode = (id: string): id is DaySummaryMode => MODE_ITEMS.some((m) => m.id === id);

/**
 * The full timeline's one header control, "View options" (a sliders icon), at
 * every width: Layout (Rows or Cards, one choice), Day summaries (Highlights,
 * Full or Off, the viewer's setting: `useDaySummaryMode`), then "Simple view"
 * (this device's toggle; left out while it can't toggle, e.g. locked).
 */
export function TimelineViewMenu({
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
    <Menu
      label="View options"
      className="btn btn-sm btn-square btn-ghost"
      width="md"
      items={[
        {
          type: "section",
          id: "layout",
          title: "Layout",
          items: VIEW_ITEMS,
          selection: { selected: view, onChange: (id) => isView(id) && onViewChange(id) },
        },
        {
          type: "section",
          id: "day-summaries",
          title: "Day summaries",
          items: MODE_ITEMS,
          selection: { selected: summaryMode, onChange: (id) => isMode(id) && onSummaryModeChange(id) },
        },
        simpleMode?.canToggle && SEPARATOR,
        simpleMode?.canToggle && {
          id: "simple-view",
          label: "Simple view",
          icon: Type,
          onAction: simpleMode.toggle,
        },
      ]}
    >
      <SlidersHorizontal className="size-4" aria-hidden="true" />
    </Menu>
  );
}

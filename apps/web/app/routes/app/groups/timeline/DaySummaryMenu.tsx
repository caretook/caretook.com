import type { DaySummaryMode } from "@caretook/data/schema";

import { ListCollapse } from "lucide-react";
import { Menu } from "~/components/ui";

const MODE_ITEMS: { id: DaySummaryMode; label: string; description: string }[] = [
  { id: "highlights", label: "Highlights", description: "What stands out" },
  { id: "full", label: "Full", description: "Everything logged" },
  { id: "off", label: "Off", description: "No summaries" },
];

const isMode = (id: string): id is DaySummaryMode => MODE_ITEMS.some((m) => m.id === id);

/**
 * The header's day-summary switch: a menu ("Day summaries") with Highlights,
 * Full and Off as one choice, the viewer's setting (`useDaySummaryMode`).
 */
export function DaySummaryMenu({
  mode,
  onChange,
}: {
  mode: DaySummaryMode;
  onChange: (mode: DaySummaryMode) => void;
}) {
  return (
    <Menu
      label="Day summaries"
      className="btn btn-sm btn-square btn-ghost"
      width="md"
      items={[
        {
          type: "section",
          id: "day-summaries",
          title: "Day summaries",
          items: MODE_ITEMS,
          selection: { selected: mode, onChange: (id) => isMode(id) && onChange(id) },
        },
      ]}
    >
      <ListCollapse className="size-4" aria-hidden="true" />
    </Menu>
  );
}

import type { TimelineView } from "@caretook/data/schema";
import type { MenuSection } from "~/components/ui";

import { Eye, LayoutList, List } from "lucide-react";
import { CIRCLE, ICON, Menu } from "~/components/ui";

/** The two list layouts, as every list's View options name them. */
export const LAYOUT_ITEMS: { id: TimelineView; label: string; icon: typeof List }[] = [
  { id: "rows", label: "Condensed", icon: List },
  { id: "cards", label: "Full", icon: LayoutList },
];

const isLayout = (id: string): id is TimelineView => LAYOUT_ITEMS.some((v) => v.id === id);

/**
 * A View options menu's Layout section: Condensed or Full, one choice. Each
 * list keeps its own setting (the timeline's `timelineView`, the providers
 * list's `providersView`); this is only the choice.
 */
export const layoutSection = (view: TimelineView, onChange: (view: TimelineView) => void): MenuSection => ({
  type: "section",
  id: "layout",
  title: "Layout",
  items: LAYOUT_ITEMS,
  selection: { selected: view, onChange: (id) => isLayout(id) && onChange(id) },
});

/** A list's "View options" (an eye icon) with only the Layout section. */
export function LayoutMenu({
  view,
  onChange,
}: {
  view: TimelineView;
  onChange: (view: TimelineView) => void;
}) {
  return (
    <Menu
      label="View options"
      variant="ghost"
      size="sm"
      shape="square"
      className={CIRCLE}
      width="md"
      items={[layoutSection(view, onChange)]}
    >
      <Eye className={ICON} aria-hidden="true" />
    </Menu>
  );
}

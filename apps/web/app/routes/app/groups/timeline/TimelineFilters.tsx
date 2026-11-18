import type { TimelineEntryKind, TimelineView } from "@caretook/data/schema";

import { LayoutList, List } from "lucide-react";
import { useLocation } from "react-router";
import { ChipGroup, IconButton } from "~/components/ui";
import { KIND_META } from "~/lib/entryDisplay";
import { clearKind, setKind } from "~/lib/timelineFilters";

const FILTERS = ["note", "symptom", "event", "vital"] as const satisfies TimelineEntryKind[];

/**
 * Kind filter chips: links that set `?kind=`, so the filter survives reloads
 * and Back. They change only the kind (see `lib/timelineFilters.ts`).
 */
export function KindFilter({ kind }: { kind: TimelineEntryKind | null }) {
  const { search } = useLocation();
  return (
    <ChipGroup
      label="Show entries"
      replace
      preventScrollReset
      links={[
        { id: "all", label: "All", to: { search: clearKind(search) }, current: !kind },
        ...FILTERS.map((k) => ({
          id: k,
          label: KIND_META[k].plural,
          to: { search: setKind(search, k) },
          current: kind === k,
        })),
      ]}
    />
  );
}

/** The rows/cards switch. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: TimelineView;
  onChange: (view: TimelineView) => void;
}) {
  return (
    <div role="group" aria-label="Layout" className="join shrink-0">
      <IconButton
        label="Rows"
        icon={List}
        pressed={view === "rows"}
        onPress={() => onChange("rows")}
        className="join-item"
      />
      <IconButton
        label="Cards"
        icon={LayoutList}
        pressed={view === "cards"}
        onPress={() => onChange("cards")}
        className="join-item"
      />
    </div>
  );
}

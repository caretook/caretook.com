import type { TimelineEntryKind, TimelineView } from "@caretook/data/schema";

import { LayoutList, List, X } from "lucide-react";
import { useLocation } from "react-router";
import { ChipGroup, IconButton, UserAvatar } from "~/components/ui";
import { KIND_META } from "~/lib/entryDisplay";
import { clearAuthor, clearKind, setKind } from "~/lib/timelineFilters";

const FILTERS = ["note", "symptom", "event", "vital"] as const satisfies TimelineEntryKind[];

/**
 * The filter chips: links that set `?kind=`, so the filter survives reloads
 * and Back. They change only the kind (see `lib/timelineFilters.ts`). With an
 * author filter on (`author`: that person's name and picture), a last chip
 * names them and clears it, keeping the kind.
 */
export function FilterChips({
  kind,
  author,
}: {
  kind: TimelineEntryKind | null;
  author: { name: string; image: string | null } | null;
}) {
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
        ...(author
          ? [
              {
                id: "author",
                label: `By ${author.name}`,
                name: `By ${author.name}: clear this filter`,
                to: { search: clearAuthor(search) },
                current: true,
                leading: <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />,
                trailing: <X className="size-3.5" aria-hidden="true" />,
              },
            ]
          : []),
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

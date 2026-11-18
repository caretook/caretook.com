import type { TimelineEntryKind, TimelineView } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { LayoutList, List } from "lucide-react";
import { Link } from "react-router";
import { KIND_META } from "~/lib/entryDisplay";

const FILTERS = ["note", "symptom", "event", "vital"] as const satisfies TimelineEntryKind[];

const chip = (active: boolean) =>
  `btn btn-sm rounded-full px-3 ${active ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100"}`;

/** Kind filter chips: links that set `?kind=`, so the filter survives reloads and Back. */
export function KindFilter({ kind }: { kind: TimelineEntryKind | null }) {
  return (
    <nav aria-label="Show entries" className="flex flex-wrap gap-1.5">
      <Link
        to={{ search: "" }}
        replace
        preventScrollReset
        className={chip(!kind)}
        aria-current={!kind ? "true" : undefined}
      >
        All
      </Link>
      {FILTERS.map((k) => (
        <Link
          key={k}
          to={{ search: `?kind=${k}` }}
          replace
          preventScrollReset
          className={chip(kind === k)}
          aria-current={kind === k ? "true" : undefined}
        >
          {KIND_META[k].plural}
        </Link>
      ))}
    </nav>
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
      <ViewButton label="Rows" pressed={view === "rows"} onPress={() => onChange("rows")}>
        <List className="size-4" aria-hidden="true" />
      </ViewButton>
      <ViewButton label="Cards" pressed={view === "cards"} onPress={() => onChange("cards")}>
        <LayoutList className="size-4" aria-hidden="true" />
      </ViewButton>
    </div>
  );
}

function ViewButton({
  label,
  pressed,
  onPress,
  children,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onPress}
      className={`join-item btn btn-sm btn-square ${pressed ? "btn-neutral" : "btn-ghost border-base-300 bg-base-100"}`}
    >
      {children}
    </button>
  );
}

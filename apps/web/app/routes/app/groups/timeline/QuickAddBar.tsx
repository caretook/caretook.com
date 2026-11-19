import type { VitalType } from "@caretook/data/schema";
import type { SheetKind } from "~/lib/appUrls";
import type { LiveEntryKind } from "~/lib/liveEntry";

import { ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { SHEET_LINK_STATE } from "./sheet";
import { VitalTypeMenu } from "./VitalTypeMenu";

// In bar order: Note, Event, Dose, Symptom, then the Vitals menu.
const TILES = [
  { kind: "note", to: "page" },
  { kind: "event", to: "page" },
  { kind: "dose", to: "dose" },
  { kind: "symptom", to: "sheet" },
] as const satisfies readonly (
  { kind: LiveEntryKind; to: "page" } | { kind: SheetKind; to: "sheet" } | { kind: "dose"; to: "dose" }
)[];

const TILE = "btn btn-ghost h-auto min-h-12 flex-col gap-0.5 px-1 py-1.5 text-xs font-medium";

/**
 * One tap to start an entry of a given kind: Note, Event, Dose, Symptom, or a
 * vital type from the Vitals menu. Five equal tiles, so it stays one row on
 * phones (writers only: the timeline leaves the bar out for viewers). Every
 * tile is a link: notes and events to their page, doses, symptoms and vitals
 * to their add sheet over the timeline (which keeps the scroll position and
 * the filters, and carries `SHEET_LINK_STATE`). The sheets' route modules are
 * fetched as soon as the bar renders, so they open offline.
 */
export function QuickAddBar({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const newEntryUrl = (kind: LiveEntryKind) => appUrls.newEntry(groupId, kind);
  const newSheetUrl = (kind: SheetKind, type?: VitalType) =>
    appUrls.newSheet(groupId, kind, { type, search });
  const sheetLinkState = SHEET_LINK_STATE;
  return (
    <div
      role="group"
      aria-label="Add to the timeline"
      className="rounded-box border-base-300 bg-base-100 grid grid-cols-5 gap-1 border p-1"
    >
      {TILES.map((tile) => {
        const { Icon, label } = KIND_META[tile.kind];
        const sheet = { state: sheetLinkState, preventScrollReset: true, prefetch: "render" as const };
        const link =
          tile.to === "page"
            ? { to: newEntryUrl(tile.kind) }
            : tile.to === "dose"
              ? { to: appUrls.newDose(groupId, { search }), ...sheet }
              : { to: newSheetUrl(tile.kind), ...sheet };
        return (
          <Link key={tile.kind} {...link} className={TILE}>
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
      <VitalTypeMenu
        className={TILE}
        onSelect={(type) =>
          void navigate(newSheetUrl("vital", type), { state: sheetLinkState, preventScrollReset: true })
        }
      >
        <KIND_META.vital.Icon className="size-5" aria-hidden="true" />
        <span className="inline-flex items-center gap-0.5">
          Vitals
          <ChevronDown className="size-3" aria-hidden="true" />
        </span>
      </VitalTypeMenu>
    </div>
  );
}

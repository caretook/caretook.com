import type { VitalType } from "@caretook/data/schema";
import type { SheetKind } from "~/lib/appUrls";
import type { LiveEntryKind } from "~/lib/liveEntry";

import { ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { SHEET_LINK_STATE } from "./sheet";
import { VitalTypeMenu } from "./VitalTypeMenu";

const TILES = [
  { kind: "note", page: true },
  { kind: "symptom", page: false },
  { kind: "event", page: true },
] as const satisfies readonly ({ kind: LiveEntryKind; page: true } | { kind: SheetKind; page: false })[];

const TILE = "btn btn-ghost h-auto min-h-12 flex-col gap-0.5 px-1 py-1.5 text-xs font-medium";

/**
 * One tap to start an entry of a given kind: Note, Symptom, Event, or a vital
 * type from the Vitals menu. Four equal tiles, so it stays one row on phones.
 * Every tile is a link: notes and events to their page, symptoms and vitals
 * to the add sheet over the timeline (which keeps the scroll position and the
 * filters, and carries `SHEET_LINK_STATE`). The sheet's route module is
 * fetched as soon as the bar renders, so it opens offline.
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
      className="rounded-box border-base-300 bg-base-100 grid grid-cols-4 gap-1 border p-1"
    >
      {TILES.map((tile) => {
        const { Icon, label } = KIND_META[tile.kind];
        const link = tile.page
          ? { to: newEntryUrl(tile.kind) }
          : {
              to: newSheetUrl(tile.kind),
              state: sheetLinkState,
              preventScrollReset: true,
              prefetch: "render" as const,
            };
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

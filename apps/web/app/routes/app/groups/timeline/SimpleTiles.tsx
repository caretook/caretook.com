import type { SimpleTile, SimpleTiles as TilesSetting } from "@caretook/data/schema";
import type { RecipientWords } from "~/lib/assistant/simpleTiles";

import { Link } from "react-router";
import { KindIcon } from "~/components/entry";
import { appUrls } from "~/lib/app-shell/appUrls";
import { tileKey, tileLabel } from "~/lib/assistant/simpleTiles";
import { STALE } from "./layout";
import { SHEET_LINK_STATE } from "./sheet";

/** Where a tile goes: its kind's simple sheet over the timeline, or a new note's page. */
const tileHref = (groupId: string, tile: SimpleTile) => {
  if (tile.kind === "note") return appUrls.newEntry(groupId, "note");
  if (tile.kind === "dose") return appUrls.newDose(groupId);
  if (tile.kind === "vital") return appUrls.newSheet(groupId, "vital", { type: tile.vitalType });
  return appUrls.newSheet(groupId, "symptom");
};

/**
 * Simple mode's four big tiles (writers only): each opens one short form,
 * the simple variant of its sheet (the feelings scale, one vital type's
 * fields, the Dose sheet) or a new note. Labelled in plain words about the
 * recipient. While nobody has chosen the tiles (they're learned from use),
 * those who can choose them get a link there; members see nothing more.
 *
 * `fresh` false (tiles remembered from earlier this session, not confirmed
 * yet) dims them (`data-stale`); `SimpleTilesSkeleton` holds their place
 * on a first visit.
 */
export function SimpleTiles({
  groupId,
  tiles,
  setting,
  words,
  canChoose,
  fresh = true,
}: {
  groupId: string;
  tiles: SimpleTile[];
  setting: TilesSetting | null;
  words: RecipientWords;
  /** You may choose the group's tiles (an owner or admin, not locked). */
  canChoose: boolean;
  /** The tiles are confirmed by the device (not remembered ones). */
  fresh?: boolean;
}) {
  return (
    <section
      aria-label="Log something"
      className={`space-y-3 ${fresh ? "" : STALE}`}
      data-simple-tiles=""
      data-stale={fresh ? undefined : ""}
    >
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const href = tileHref(groupId, tile);
          return (
            <li key={tileKey(tile)}>
              <Link
                to={href}
                state={tile.kind === "note" ? undefined : SHEET_LINK_STATE}
                preventScrollReset
                prefetch="render"
                className="btn btn-outline h-auto min-h-24 w-full flex-col gap-2 py-4 text-xl font-semibold whitespace-normal"
                data-tile={tileKey(tile)}
              >
                <KindIcon kind={tile.kind} />
                {tileLabel(tile, words)}
              </Link>
            </li>
          );
        })}
      </ul>
      {!setting && canChoose && (
        <p className="text-base" data-tiles-hint="">
          <Link to={appUrls.groupSettings(groupId, "details")} className="link link-primary">
            Choose the tiles
          </Link>
        </p>
      )}
    </section>
  );
}

/** The four tiles' place while they aren't known yet (a first visit this session). */
export function SimpleTilesSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3" aria-hidden="true" data-simple-skeleton="tiles">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="skeleton rounded-box min-h-24" />
      ))}
    </ul>
  );
}

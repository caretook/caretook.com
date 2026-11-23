import type { EasyTile, EasyTiles as TilesSetting } from "@caretook/data/schema";
import type { RecipientWords } from "~/lib/assistant/easyTiles";

import { Link } from "react-router";
import { KindIcon } from "~/components/entry";
import { Button, LINK, Skeleton } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { tileKey, tileLabel } from "~/lib/assistant/easyTiles";
import { STALE } from "./layout";
import { SHEET_LINK_STATE } from "./sheet";

/**
 * The tiles: two by two on phones (four don't fit a row inside the block's
 * card), one row of four from `sm`. Nothing scrolls or clips; the buttons'
 * min-h-11 keeps every target at least 44 px.
 */
const TILE_ROW = "grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4";
const TILE_CELL = "min-w-0";

/** Where a tile goes: its kind's easy sheet over the timeline, or a new note's page. */
const tileHref = (groupId: string, tile: EasyTile) => {
  if (tile.kind === "note") return appUrls.newEntry(groupId, "note");
  if (tile.kind === "dose") return appUrls.newDose(groupId);
  if (tile.kind === "vital") return appUrls.newSheet(groupId, "vital", { type: tile.vitalType });
  return appUrls.newSheet(groupId, "symptom");
};

/**
 * Easy mode's four big tiles (writers only): each opens one short form,
 * the easy variant of its sheet (the feelings scale, one vital type's
 * fields, the Dose sheet) or a new note. Labelled in plain words about the
 * recipient. While nobody has chosen the tiles (they're learned from use),
 * those who can choose them get a link there; members see nothing more.
 *
 * `fresh` false (tiles remembered from earlier this session, not confirmed
 * yet) dims them (`data-stale`); `EasyTilesSkeleton` holds their place
 * on a first visit.
 */
export function EasyTiles({
  groupId,
  tiles,
  setting,
  words,
  canChoose,
  fresh = true,
}: {
  groupId: string;
  tiles: EasyTile[];
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
      data-easy-tiles=""
      data-stale={fresh ? undefined : ""}
    >
      <ul className={TILE_ROW}>
        {tiles.map((tile) => {
          const href = tileHref(groupId, tile);
          return (
            <li key={tileKey(tile)} className={TILE_CELL}>
              <Button
                to={href}
                state={tile.kind === "note" ? undefined : SHEET_LINK_STATE}
                preventScrollReset
                prefetch="render"
                block
                className="h-full min-h-11 flex-col gap-1 px-1 py-2 text-sm leading-tight font-semibold whitespace-normal"
                data-tile={tileKey(tile)}
              >
                <KindIcon kind={tile.kind} />
                {tileLabel(tile, words)}
              </Button>
            </li>
          );
        })}
      </ul>
      {!setting && canChoose && (
        <p className="text-base" data-tiles-hint="">
          <Link to={appUrls.groupSettings(groupId, "details")} className={LINK}>
            Choose the tiles
          </Link>
        </p>
      )}
    </section>
  );
}

/** The four tiles' place while they aren't known yet (a first visit this session). */
export function EasyTilesSkeleton() {
  return (
    <ul className={TILE_ROW} aria-hidden="true" data-easy-skeleton="tiles">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={`h-16 ${TILE_CELL}`}>
          <Skeleton lines={3} />
        </li>
      ))}
    </ul>
  );
}

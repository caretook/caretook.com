import type { EasyTiles } from "@caretook/data/schema";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { parseEasyTiles } from "./easyTiles";
import { useRememberedQuery } from "../sync/useRememberedQuery";

// Easy mode's group-wide setup on the device (assistant PRD): how the
// group's tiles are chosen (`care_group.easy_tiles`, synced) and the
// recipient's pronouns, which the tiles' labels use. Read by the easy
// timeline and its sheets, and by group settings Details' tiles card.

/** The group's tile choice (JSON text, null: learned) and the recipient's pronouns. */
export type EasySetupRow = { easy_tiles: string | null; pronouns: string | null };

export const easySetupQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT g.easy_tiles, r.pronouns
        FROM care_group g LEFT JOIN care_recipient r ON r.group_id = g.id
        WHERE g.id = ? LIMIT 1`,
  params: [groupId],
});

/**
 * The group's tile choice (null: nobody has chosen, so they're learned) and
 * the recipient's pronouns, live, through the tile cache: `ready` once
 * they're known (remembered from earlier this session or read), `fresh`
 * once read live.
 */
export function useEasySetup(groupId: string): {
  setting: EasyTiles | null;
  pronouns: string | null;
  ready: boolean;
  fresh: boolean;
} {
  const query = useMemo(() => easySetupQuery(groupId), [groupId]);
  const { value, fresh } = useRememberedQuery<EasySetupRow>({ groupId, name: "easySetup" }, query);
  const row = value?.[0];
  const json = row?.easy_tiles;
  const setting = useMemo(() => parseEasyTiles(json), [json]);
  return { setting, pronouns: row?.pronouns ?? null, ready: value !== undefined, fresh };
}

import type { SimpleTiles } from "@caretook/data/schema";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { parseSimpleTiles } from "./simpleTiles";
import { useRememberedQuery } from "../sync/useRememberedQuery";

// Simple mode's group-wide setup on the device (assistant PRD): how the
// group's tiles are chosen (`care_group.simple_tiles`, synced) and the
// recipient's pronouns, which the tiles' labels use. Read by the simple
// timeline and its sheets, and by group settings Details' tiles card.

/** The group's tile choice (JSON text, null: learned) and the recipient's pronouns. */
export type SimpleSetupRow = { simple_tiles: string | null; pronouns: string | null };

export const simpleSetupQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT g.simple_tiles, r.pronouns
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
export function useSimpleSetup(groupId: string): {
  setting: SimpleTiles | null;
  pronouns: string | null;
  ready: boolean;
  fresh: boolean;
} {
  const query = useMemo(() => simpleSetupQuery(groupId), [groupId]);
  const { value, fresh } = useRememberedQuery<SimpleSetupRow>({ groupId, name: "simpleSetup" }, query);
  const row = value?.[0];
  const json = row?.simple_tiles;
  const setting = useMemo(() => parseSimpleTiles(json), [json]);
  return { setting, pronouns: row?.pronouns ?? null, ready: value !== undefined, fresh };
}

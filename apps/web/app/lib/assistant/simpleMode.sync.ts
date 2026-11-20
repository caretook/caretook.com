import type { SimpleTiles } from "@caretook/data/schema";
import type { LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { parseSimpleTiles } from "./simpleTiles";
import { useLiveQuery } from "../sync/index";

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

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_SETUP: SimpleSetupRow[] = [];

/** The group's tile choice (null: nobody has chosen, so they're learned) and the recipient's pronouns, live. */
export function useSimpleSetup(groupId: string): { setting: SimpleTiles | null; pronouns: string | null } {
  const query = useMemo(() => simpleSetupQuery(groupId), [groupId]);
  const [row] = useLiveQuery<SimpleSetupRow>(query.sql, query.params, NO_SETUP);
  const json = row?.simple_tiles;
  const setting = useMemo(() => parseSimpleTiles(json), [json]);
  return { setting, pronouns: row?.pronouns ?? null };
}

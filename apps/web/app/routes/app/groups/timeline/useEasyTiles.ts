import type { EasyTile, EasyTiles } from "@caretook/data/schema";
import type { RecipientWords } from "~/lib/assistant/easyTiles";
import type { LearnedRow } from "./easyRows";

import { useMemo, useState } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { groupTiles, recipientWords } from "~/lib/assistant/easyTiles";
import { useEasySetup } from "~/lib/assistant/easyMode.sync";
import { useRememberedQuery } from "~/lib/sync/useRememberedQuery";
import { learnedEntriesQuery, toLearnedEntry } from "./easyRows";

const NO_ENTRIES: LearnedRow[] = [];

/** How tile labels and the feelings sheet talk about the group's recipient (live from the profile). */
export function useRecipientWords(groupId: string): RecipientWords {
  const { displayName } = useGroup();
  const { pronouns } = useEasySetup(groupId);
  return useMemo(() => recipientWords(displayName, pronouns), [displayName, pronouns]);
}

/**
 * Easy mode's four tiles, live: the group's choice (learned, fixed or
 * picked) and, for learned tiles, the last 30 days' entries; plus the
 * recipient's words for their labels. `setting` is null while nobody has
 * chosen (the first-run hint shows). Read through the tile cache: `ready`
 * once both queries are known (remembered from earlier this session or
 * read; a skeleton until then), `fresh` once both are read live.
 */
export function useEasyTiles(groupId: string): {
  tiles: EasyTile[];
  setting: EasyTiles | null;
  words: RecipientWords;
  ready: boolean;
  fresh: boolean;
} {
  // Learning looks back from when the page opened; a long-open page is a few hours out at most.
  const [opened] = useState(() => new Date());
  const query = useMemo(() => learnedEntriesQuery(groupId, opened), [groupId, opened]);
  const learned = useRememberedQuery<LearnedRow>({ groupId, name: "easyTiles:learned" }, query);
  const rows = learned.value ?? NO_ENTRIES;
  const setup = useEasySetup(groupId);
  const { setting } = setup;
  const words = useRecipientWords(groupId);
  const tiles = useMemo(() => groupTiles(setting, rows.map(toLearnedEntry), new Date()), [setting, rows]);
  return {
    tiles,
    setting,
    words,
    ready: setup.ready && learned.value !== undefined,
    fresh: setup.fresh && learned.fresh,
  };
}

import type { TagRow } from "~/lib/tags/tags.sync";
import type { LinkCandidate, LinkPick, LinkType } from "~/lib/todos/linkOptions";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { recentlyViewed } from "~/lib/core/recentlyViewed";
import { getSync, useLiveQuery } from "~/lib/sync";
import { tagsQuery } from "~/lib/tags/tags.sync";
import {
  matchingTagIds,
  parseSearch,
  searchIndexStatus,
  subscribeSearchIndexChanges,
  subscribeSearchIndexStatus,
} from "~/lib/search/search.sync";
import { linkOptions, linkTypeWord } from "~/lib/todos/linkOptions";
import { searchLinkables, suggestLinkables } from "~/lib/todos/linkSearch.sync";

/** Wait this long after the last keystroke before searching (as the search page's field). */
export const LINK_SEARCH_DEBOUNCE_MS = 200;

const serverStatus = () => "preparing" as const;
type Found = { query: string; candidates: LinkCandidate[]; wordType: LinkType | null };
const NONE: Found = { query: "", candidates: [], wordType: null };
const NO_TAGS: TagRow[] = [];
const NO_LINKS: { id: string }[] = [];

/**
 * The "Link to…" box's options for the typed text, live: searched a moment
 * after the last keystroke, again whenever the index takes in a change or
 * becomes ready, or a tag the text names is renamed, or something is tagged
 * or untagged with one (B-989: tags aren't in the index; as `useSearchPage`),
 * only the `type` chosen (null: all), and with what's `linked` left out.
 * With nothing to search (no text, or a type word alone), the suggestions
 * instead (B-947: `cameFrom`, the next events, this user's recently viewed),
 * which need no index. The previous options stay up until the next arrive,
 * so typing never flickers the list. `wordType` is the type word the shown
 * options were narrowed by, and `forText` the text they're for.
 */
export function useLinkSearch(
  groupId: string,
  text: string,
  {
    linked,
    type = null,
    cameFrom = null,
  }: { linked: readonly string[]; type?: LinkType | null; cameFrom?: LinkPick | null },
) {
  const { userId } = useGroup();
  const [query, setQuery] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), LINK_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const status = useSyncExternalStore(subscribeSearchIndexStatus, searchIndexStatus, serverStatus);
  const [changes, setChanges] = useState(0);
  useEffect(() => subscribeSearchIndexChanges(() => setChanges((n) => n + 1)), []);
  const tagsSource = tagsQuery(groupId);
  const tags = useLiveQuery<TagRow>(tagsSource.sql, tagsSource.params, NO_TAGS);
  // A rename can make the text name a tag, or stop naming it: rerun on the names.
  const tagKey = JSON.stringify(tags.map((t) => [t.id, t.name]));
  const named = JSON.stringify(matchingTagIds(tags, parseSearch(linkTypeWord(query).rest)));
  const links = useLiveQuery<{ id: string }>(
    "SELECT id FROM record_tag WHERE group_id = ? AND tag_id IN (SELECT value FROM json_each(?)) ORDER BY id",
    [groupId, named],
    NO_LINKS,
  );
  const linkKey = links.map((l) => l.id).join(",");
  const linkedKey = JSON.stringify(linked);
  const cameFromKey = cameFrom ? JSON.stringify(cameFrom) : "";
  const [found, setFound] = useState(NONE);

  useEffect(() => {
    let current = true;
    let db: ReturnType<typeof getSync>;
    try {
      db = getSync();
    } catch {
      return; // Signing out: nothing left to search.
    }
    const exclude = JSON.parse(linkedKey) as string[];
    const word = linkTypeWord(query);
    const run = word.rest.trim()
      ? searchLinkables(db, groupId, query, { exclude, type })
      : suggestLinkables(db, groupId, {
          cameFrom: cameFromKey ? (JSON.parse(cameFromKey) as LinkPick) : null,
          recent: recentlyViewed(userId),
          linked: exclude,
          type: word.type ?? type,
        }).then((candidates) => ({ candidates, wordType: word.type }));
    run
      .then((result) => {
        if (current) setFound({ query, ...result });
      })
      .catch((e: unknown) => {
        // The index's tables are being created: nothing to show yet.
        if (searchIndexStatus() !== "preparing") console.error("Link search failed", e);
      });
    return () => {
      current = false;
    };
  }, [groupId, userId, query, type, linkedKey, cameFromKey, tagKey, linkKey, changes, status]);

  const options = useMemo(
    () => linkOptions(found.candidates, new Date(), { linked: JSON.parse(linkedKey) as string[] }),
    [found, linkedKey],
  );
  return { options, status, wordType: found.wordType, forText: found.query };
}

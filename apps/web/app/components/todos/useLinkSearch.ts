import type { TagRow } from "~/lib/tags/tags.sync";
import type { LinkCandidate, LinkType } from "~/lib/todos/linkOptions";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import { searchLinkables } from "~/lib/todos/linkSearch.sync";

/** Wait this long after the last keystroke before searching (as the search page's field). */
export const LINK_SEARCH_DEBOUNCE_MS = 200;

const serverStatus = () => "preparing" as const;
const NONE: LinkCandidate[] = [];
const NO_TAGS: TagRow[] = [];
const NO_LINKS: { id: string }[] = [];

/**
 * The "Link to…" box's options for the typed text, live: searched a moment
 * after the last keystroke, again whenever the index takes in a change or
 * becomes ready, or a tag the text names is renamed, or something is tagged
 * or untagged with one (B-989: tags aren't in the index; as `useSearchPage`),
 * only the `type` chosen (null: all), and with what's `linked` left out.
 * The previous options stay up until the next arrive, so typing never
 * flickers the list.
 */
export function useLinkSearch(
  groupId: string,
  text: string,
  linked: readonly string[],
  type: LinkType | null = null,
) {
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
  const [found, setFound] = useState(NONE);

  useEffect(() => {
    let current = true;
    let db: ReturnType<typeof getSync>;
    try {
      db = getSync();
    } catch {
      return; // Signing out: nothing left to search.
    }
    searchLinkables(db, groupId, query, { exclude: JSON.parse(linkedKey) as string[], type })
      .then((candidates) => {
        if (current) setFound(candidates);
      })
      .catch((e: unknown) => {
        // The index's tables are being created: nothing to show yet.
        if (searchIndexStatus() !== "preparing") console.error("Link search failed", e);
      });
    return () => {
      current = false;
    };
  }, [groupId, query, type, linkedKey, tagKey, linkKey, changes, status]);

  const options = useMemo(
    () => linkOptions(query.trim() ? found : NONE, new Date(), { linked: JSON.parse(linkedKey) as string[] }),
    [found, query, linkedKey],
  );
  return { options, status };
}

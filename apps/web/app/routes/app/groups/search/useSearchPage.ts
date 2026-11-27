import type { SearchPageData } from "./loadSearch";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { parseSearchPage } from "~/lib/search/searchResults";
import { getSync, useLiveQuery } from "~/lib/sync";
import {
  matchingTagIds,
  parseSearch,
  searchIndexStatus,
  subscribeSearchIndexChanges,
  subscribeSearchIndexStatus,
} from "~/lib/search/search.sync";
import { loadSearch } from "./loadSearch";

const serverStatus = () => "preparing" as const;
const NO_LINKS: { id: string }[] = [];

/**
 * The search page's results, live: the loader's first (so Back shows the
 * same results at once), then searched again on the device whenever the
 * URL's text, full section, period or tag changes, the index takes in a change (a
 * synced or local edit), the links of the tag or of a tag the text names
 * (`tags`, the group's) change (they aren't in the index), a tag of the group is renamed, recolored,
 * deleted or merged (B-979: the results' tag chips are copies; tags aren't in the index either), or the
 * index becomes ready. The previous results
 * stay up until the next arrive, so typing never flickers the list.
 */
export function useSearchPage(
  groupId: string,
  initial: SearchPageData,
  tags: readonly { id: string; name: string; color?: string | null }[],
) {
  const { search } = useLocation();
  const { q, all, period, tag } = parseSearchPage(search);
  const watched = JSON.stringify([...(tag ? [tag] : []), ...matchingTagIds(tags, parseSearch(q))]);
  const links = useLiveQuery<{ id: string }>(
    "SELECT id FROM record_tag WHERE group_id = ? AND tag_id IN (SELECT value FROM json_each(?)) ORDER BY id",
    [groupId, watched],
    NO_LINKS,
  );
  const linkKey = links.map((l) => l.id).join(",");
  // B-979: rerun on the tags' names and colors rather than have the chips read the live tags by id:
  // one key, no change to the results' shape, and a deleted or merged tag drops off (or a rename
  // that no longer matches the text drops its items) for free. It changes only on a tag edit, never on typing.
  const tagKey = JSON.stringify(tags.map((t) => [t.id, t.name, t.color ?? null]));
  const status = useSyncExternalStore(subscribeSearchIndexStatus, searchIndexStatus, serverStatus);
  const [changes, setChanges] = useState(0);
  useEffect(() => subscribeSearchIndexChanges(() => setChanges((n) => n + 1)), []);

  // New loader data (a navigation) replaces whatever was searched since.
  const [state, setState] = useState({ initial, data: initial });
  if (state.initial !== initial) setState({ initial, data: initial });

  useEffect(() => {
    let current = true;
    let db: ReturnType<typeof getSync>;
    try {
      db = getSync();
    } catch {
      return; // Signing out: nothing left to search.
    }
    loadSearch(db, groupId, { q, all, period, tag })
      .then((data) => {
        if (current) setState((s) => ({ ...s, data }));
      })
      .catch((e: unknown) => console.error("Search failed", e));
    return () => {
      current = false;
    };
  }, [groupId, q, all, period, tag, watched, linkKey, tagKey, changes, status]);

  const data = state.initial === initial ? state.data : initial;
  return {
    /** The text in the URL now (the results can still be the previous search's for a moment). */
    q,
    /** The care period in the URL now (`?period=`; checked against the group's by the page). */
    period,
    /** The tag in the URL now (`?tag=`; `data.tag` is it once checked against the group's). */
    tag,
    data,
    /** "Preparing search…" until the index exists in this build's format. */
    preparing: status === "preparing",
    unavailable: status === "unavailable",
  };
}

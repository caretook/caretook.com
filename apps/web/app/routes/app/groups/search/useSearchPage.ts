import type { SearchPageData } from "./loadSearch";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { parseSearchPage } from "~/lib/search/searchResults";
import { getSync, useLiveQuery } from "~/lib/sync";
import {
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
 * synced or local edit), the tag's links change (they aren't in the index), or the index becomes ready. The previous results
 * stay up until the next arrive, so typing never flickers the list.
 */
export function useSearchPage(groupId: string, initial: SearchPageData) {
  const { search } = useLocation();
  const { q, all, period, tag } = parseSearchPage(search);
  const links = useLiveQuery<{ id: string }>(
    "SELECT id FROM record_tag WHERE group_id = ? AND tag_id = ? ORDER BY id",
    [groupId, tag ?? ""],
    NO_LINKS,
  );
  const linkKey = links.map((l) => l.id).join(",");
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
  }, [groupId, q, all, period, tag, linkKey, changes, status]);

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

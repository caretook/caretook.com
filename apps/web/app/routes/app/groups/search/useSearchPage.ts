import type { SearchPageData } from "./loadSearch";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { parseSearchPage } from "~/lib/searchResults";
import { getSync } from "~/lib/sync";
import {
  searchIndexStatus,
  subscribeSearchIndexChanges,
  subscribeSearchIndexStatus,
} from "~/lib/sync/search";
import { loadSearch } from "./loadSearch";

const serverStatus = () => "preparing" as const;

/**
 * The search page's results, live: the loader's first (so Back shows the
 * same results at once), then searched again on the device whenever the
 * URL's text or full section changes, the index takes in a change (a
 * synced or local edit), or the index becomes ready. The previous results
 * stay up until the next arrive, so typing never flickers the list.
 */
export function useSearchPage(groupId: string, initial: SearchPageData) {
  const { search } = useLocation();
  const { q, all } = parseSearchPage(search);
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
    loadSearch(db, groupId, { q, all })
      .then((data) => {
        if (current) setState((s) => ({ ...s, data }));
      })
      .catch((e: unknown) => console.error("Search failed", e));
    return () => {
      current = false;
    };
  }, [groupId, q, all, changes, status]);

  const data = state.initial === initial ? state.data : initial;
  return {
    /** The text in the URL now (the results can still be the previous search's for a moment). */
    q,
    data,
    /** "Preparing search…" until the index exists in this build's format. */
    preparing: status === "preparing",
    unavailable: status === "unavailable",
  };
}

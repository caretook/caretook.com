import type { LinkCandidate } from "~/lib/todos/linkOptions";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSync } from "~/lib/sync";
import {
  searchIndexStatus,
  subscribeSearchIndexChanges,
  subscribeSearchIndexStatus,
} from "~/lib/search/search.sync";
import { linkOptions } from "~/lib/todos/linkOptions";
import { searchLinkables } from "~/lib/todos/linkSearch.sync";

/** Wait this long after the last keystroke before searching (as the search page's field). */
export const LINK_SEARCH_DEBOUNCE_MS = 200;

const serverStatus = () => "preparing" as const;
const NONE: LinkCandidate[] = [];

/**
 * The "Link to…" box's options for the typed text, live: searched a moment
 * after the last keystroke, again whenever the index takes in a change or
 * becomes ready, and with what's `linked` left out. The previous options
 * stay up until the next arrive, so typing never flickers the list.
 */
export function useLinkSearch(groupId: string, text: string, linked: readonly string[]) {
  const [query, setQuery] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), LINK_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const status = useSyncExternalStore(subscribeSearchIndexStatus, searchIndexStatus, serverStatus);
  const [changes, setChanges] = useState(0);
  useEffect(() => subscribeSearchIndexChanges(() => setChanges((n) => n + 1)), []);
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
    searchLinkables(db, groupId, query, { exclude: JSON.parse(linkedKey) as string[] })
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
  }, [groupId, query, linkedKey, changes, status]);

  const options = useMemo(
    () => linkOptions(query.trim() ? found : NONE, new Date(), { linked: JSON.parse(linkedKey) as string[] }),
    [found, query, linkedKey],
  );
  return { options, status };
}

import type { SearchIndexStatus } from "~/lib/sync/search";

import { useSyncExternalStore } from "react";
import { searchIndexStatus, subscribeSearchIndexStatus } from "~/lib/sync/search";

/** The device's search index status, live ("Preparing search…" until it's ready). */
export const useSearchIndexStatus = (): SearchIndexStatus =>
  useSyncExternalStore(subscribeSearchIndexStatus, searchIndexStatus, () => "preparing");

/**
 * The index's status once it's ready, or after `ms` (a reload with `?q=`
 * waits a moment for the index instead of flashing "Preparing search…").
 */
export const settledSearchIndexStatus = (ms = 1000): Promise<SearchIndexStatus> => {
  if (searchIndexStatus() !== "preparing") return Promise.resolve(searchIndexStatus());
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve(searchIndexStatus());
    };
    const timer = setTimeout(done, ms);
    const unsubscribe = subscribeSearchIndexStatus(() => {
      if (searchIndexStatus() !== "preparing") done();
    });
  });
};

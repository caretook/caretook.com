import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { getGroup, useGroup } from "~/lib/group";
import { loadSettings } from "~/lib/me";
import { recordSearch } from "~/lib/recentSearches";
import { parseSearchPage } from "~/lib/searchResults";
import { sessionContext } from "~/lib/session";
import { loadSearch } from "./loadSearch";
import { RecentSearches } from "./RecentSearches";
import { SearchField } from "./SearchField";
import { SearchResults } from "./SearchResults";
import { useSearchPage } from "./useSearchPage";

// Shared by web + native. Search one care group's entries, providers and
// medications on the device (`lib/sync/search.ts`), offline too. The text
// (`?q=`) and the section shown in full (`?all=`) live in the URL, so Back
// from a result comes back to the same results. A search that's used
// (the field left with it, or one of its results opened) joins this
// device's recent searches, which the empty page offers with a tip.

export const meta = () => [{ title: "Search · Caretook" }];

/** The first results (and the units entries show in), read before the page renders. */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const query = parseSearchPage(new URL(request.url).search);
  const [data, settings] = await Promise.all([
    loadSearch(db, params.groupId, query),
    loadSettings(request, db.userId),
  ]);
  return { data, units: settings.units };
}

/**
 * The page searches again on the device as the text changes, so a new
 * search (the same path) doesn't rerun the loader. Anything else does.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function SearchPage({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { q, data, preparing, unavailable } = useSearchPage(params.groupId, loaderData.data);
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-search-page>
      <h1 className="sr-only">Search {group.displayName}</h1>
      <SearchField
        groupId={params.groupId}
        urlQuery={q}
        label={`Search ${group.displayName}`}
        onUsed={(text) => recordSearch(group.userId, text)}
      />
      {/* Opening a result (any link in them) uses the search they're for. */}
      <div
        className="space-y-4"
        onClickCapture={(e) => {
          if ((e.target as Element).closest("a")) recordSearch(group.userId, data.q);
        }}
      >
        <SearchResults
          data={data}
          groupId={params.groupId}
          canWrite={group.canWrite}
          units={loaderData.units}
          preparing={preparing}
          unavailable={unavailable}
        />
      </div>
      {!q.trim() && <RecentSearches groupId={params.groupId} userId={group.userId} />}
    </main>
  );
}
